import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildInsuranceScope,
  type InsuranceScopeParticipant,
} from "@/lib/agreement-insurance-scope";

export const dynamic = "force-dynamic";

async function resolveTripBySlug(slug: string) {
  // Service role: publiczna rezerwacja nie ma sesji, a RLS na trips ogranicza anon.
  const admin = createAdminClient();

  let { data: trip, error } = await admin
    .from("trips")
    .select("id, is_active, form_extra_insurances")
    .eq("slug", slug)
    .maybeSingle<{ id: string; is_active: boolean; form_extra_insurances: unknown }>();

  if (!trip && !error) {
    const byPublic = await admin
      .from("trips")
      .select("id, is_active, form_extra_insurances")
      .eq("public_slug", slug)
      .maybeSingle<{ id: string; is_active: boolean; form_extra_insurances: unknown }>();
    trip = byPublic.data;
    error = byPublic.error;
  }

  return { admin, trip, error };
}

/**
 * Publiczny endpoint zakresu ubezpieczenia dla formularza rezerwacji.
 * Zwraca ten sam tekst {{insurance_scope}} co przepływ e-mail/PDF, dzięki czemu
 * podgląd umowy na stronie rezerwacji pokazuje wypełnione pole.
 *
 * Body (opcjonalne): { participants: [{ first_name, last_name, selected_services }] }
 * - z uczestnikami: zakres wyliczony na podstawie wybranych ubezpieczeń,
 * - bez uczestników: podstawowe + dostępne ubezpieczenia dodatkowe.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;

    let participants: InsuranceScopeParticipant[] | null = null;
    try {
      const body = (await request.json()) as {
        participants?: InsuranceScopeParticipant[];
      };
      if (Array.isArray(body?.participants)) {
        participants = body.participants;
      }
    } catch {
      // brak/niepoprawne body — traktuj jak podgląd bez uczestników
      participants = null;
    }

    const { admin, trip, error } = await resolveTripBySlug(slug);

    if (error || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    if (!trip.is_active) {
      return NextResponse.json({ error: "trip_not_available" }, { status: 403 });
    }

    const hasParticipants = Boolean(participants && participants.length > 0);

    const scope = await buildInsuranceScope(
      admin,
      trip.id,
      hasParticipants ? participants : null,
      trip.form_extra_insurances,
      hasParticipants ? undefined : { includeAvailableExtras: true },
    );

    return NextResponse.json({ scope });
  } catch (err) {
    console.error("Error in POST /api/trips/by-slug/[slug]/insurance-scope:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}
