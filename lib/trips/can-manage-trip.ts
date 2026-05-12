import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin lub koordynator przypisany do danej wycieczki (`allowed_trip_ids`).
 *
 * Profil jest odczytywany klientem service role — RLS na `profiles` często nie pozwala
 * aplikacji na odczyt roli przez zwykły klient sesji, co skutkowało stałym 403 na PATCH treści.
 */
export async function canManageTrip(
  supabase: SupabaseClient,
  tripId: string,
): Promise<boolean> {
  let userId: string | null = null;

  const claimsResult = await supabase.auth.getClaims();
  const nested = claimsResult.data?.claims as { sub?: string } | undefined;
  if (nested?.sub) {
    userId = nested.sub;
  }

  if (!userId) {
    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id ?? null;
  }

  if (!userId) return false;

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role, allowed_trip_ids")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return false;
  }

  if (profile.role === "admin") return true;

  const ids = profile.allowed_trip_ids;
  if (profile.role === "coordinator" && Array.isArray(ids)) {
    return ids.some((tid) => String(tid) === String(tripId));
  }

  return false;
}
