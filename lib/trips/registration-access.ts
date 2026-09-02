import { timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";
import { canManageTrip } from "@/lib/trips/can-manage-trip";

export type RegistrationAccessError =
  | "missing_token"
  | "invalid_token"
  | "trip_not_found"
  | "trip_inactive";

export type TripRegistrationRow = {
  id: string;
  slug: string;
  public_slug: string | null;
  is_active: boolean;
  registration_token: string;
};

const TRIP_REGISTRATION_SELECT =
  "id, slug, public_slug, is_active, registration_token";

export function buildTripClientUrl(
  slug: string,
  token: string,
  path?: "reserve",
  baseUrl?: string,
): string {
  const base = (baseUrl ?? resolvePublicBaseUrl()).replace(/\/$/, "");
  const suffix = path === "reserve" ? "/reserve" : "";
  const params = new URLSearchParams({ token });
  return `${base}/trip/${slug}${suffix}?${params.toString()}`;
}

export function appendRegistrationTokenQuery(
  path: string,
  token: string,
): string {
  const [pathname, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("token", token);
  return `${pathname}?${params.toString()}`;
}

function normalizeUuid(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateRegistrationToken(
  trip: Pick<TripRegistrationRow, "registration_token">,
  token: string | null | undefined,
): boolean {
  const normalizedToken = normalizeUuid(token);
  const expected = normalizeUuid(trip.registration_token);
  if (!normalizedToken || !expected) return false;

  try {
    const tokenBuffer = Buffer.from(normalizedToken, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (tokenBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    return normalizedToken === expected;
  }
}

export async function resolveTripBySlug(
  admin: SupabaseClient,
  slug: string,
): Promise<{ trip: TripRegistrationRow | null; error: unknown }> {
  let { data: trip, error } = await admin
    .from("trips")
    .select(TRIP_REGISTRATION_SELECT)
    .eq("slug", slug)
    .maybeSingle<TripRegistrationRow>();

  if (!trip && !error) {
    const byPublic = await admin
      .from("trips")
      .select(TRIP_REGISTRATION_SELECT)
      .eq("public_slug", slug)
      .maybeSingle<TripRegistrationRow>();
    trip = byPublic.data;
    error = byPublic.error;
  }

  return { trip, error };
}

export type RegistrationAccessResult =
  | { ok: true; trip: TripRegistrationRow }
  | { ok: false; error: RegistrationAccessError };

export async function assertRegistrationAccess(
  admin: SupabaseClient,
  slug: string,
  token: string | null | undefined,
): Promise<RegistrationAccessResult> {
  const normalizedToken = normalizeUuid(token);
  if (!normalizedToken) {
    return { ok: false, error: "missing_token" };
  }

  const { trip, error } = await resolveTripBySlug(admin, slug);
  if (error || !trip) {
    return { ok: false, error: "trip_not_found" };
  }

  if (!trip.is_active) {
    return { ok: false, error: "trip_inactive" };
  }

  if (!validateRegistrationToken(trip, normalizedToken)) {
    return { ok: false, error: "invalid_token" };
  }

  return { ok: true, trip };
}

export async function assertRegistrationAccessByTripId(
  admin: SupabaseClient,
  tripId: string,
  token: string | null | undefined,
): Promise<RegistrationAccessResult> {
  const normalizedToken = normalizeUuid(token);
  if (!normalizedToken) {
    return { ok: false, error: "missing_token" };
  }

  const { data: trip, error } = await admin
    .from("trips")
    .select(TRIP_REGISTRATION_SELECT)
    .eq("id", tripId)
    .maybeSingle<TripRegistrationRow>();

  if (error || !trip) {
    return { ok: false, error: "trip_not_found" };
  }

  if (!trip.is_active) {
    return { ok: false, error: "trip_inactive" };
  }

  if (!validateRegistrationToken(trip, normalizedToken)) {
    return { ok: false, error: "invalid_token" };
  }

  return { ok: true, trip };
}

export function registrationAccessErrorStatus(
  error: RegistrationAccessError,
): number {
  switch (error) {
    case "trip_not_found":
      return 404;
    case "trip_inactive":
    case "missing_token":
    case "invalid_token":
    default:
      return 403;
  }
}

export const REGISTRATION_LINK_INACTIVE_MESSAGE =
  "Ten link rezerwacji jest nieaktywny. Skontaktuj się z biurem podróży, aby otrzymać poprawny link.";

export type RegistrationAccessWithBypassResult =
  | { ok: true; trip: TripRegistrationRow; bypass: boolean }
  | { ok: false; error: RegistrationAccessError };

/** Walidacja tokenu z opcjonalnym bypass dla admina/koordynatora (podgląd w panelu). */
export async function assertRegistrationAccessWithBypass(
  admin: SupabaseClient,
  sessionSupabase: SupabaseClient,
  slug: string,
  token: string | null | undefined,
): Promise<RegistrationAccessWithBypassResult> {
  const access = await assertRegistrationAccess(admin, slug, token);
  if (access.ok) {
    return { ok: true, trip: access.trip, bypass: false };
  }

  if (
    access.error === "missing_token" ||
    access.error === "invalid_token"
  ) {
    const { trip } = await resolveTripBySlug(admin, slug);
    if (trip && (await canManageTrip(sessionSupabase, trip.id))) {
      return { ok: true, trip, bypass: true };
    }
  }

  return access;
}

export async function assertRegistrationAccessByTripIdWithBypass(
  admin: SupabaseClient,
  sessionSupabase: SupabaseClient,
  tripId: string,
  token: string | null | undefined,
): Promise<RegistrationAccessWithBypassResult> {
  const access = await assertRegistrationAccessByTripId(admin, tripId, token);
  if (access.ok) {
    return { ok: true, trip: access.trip, bypass: false };
  }

  if (
    access.error === "missing_token" ||
    access.error === "invalid_token"
  ) {
    if (await canManageTrip(sessionSupabase, tripId)) {
      const { data: trip } = await admin
        .from("trips")
        .select(TRIP_REGISTRATION_SELECT)
        .eq("id", tripId)
        .maybeSingle<TripRegistrationRow>();
      if (trip) {
        return { ok: true, trip, bypass: true };
      }
    }
  }

  return access;
}
