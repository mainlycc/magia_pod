import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  assertRegistrationAccessWithBypass,
  registrationAccessErrorStatus,
} from "@/lib/trips/registration-access";
import {
  buildInsuranceScope,
  type InsuranceScopeParticipant,
} from "@/lib/agreement-insurance-scope";

export const dynamic = "force-dynamic";

/**
 * Publiczny endpoint zakresu ubezpieczenia dla formularza rezerwacji.
 * Zwraca ten sam tekst {{insurance_scope}} co przepływ e-mail/PDF, dzięki czemu
 * podgląd umowy na stronie rezerwacji pokazuje wypełnione pole.
 *
 * Body (opcjonalne): { participants: [...], registration_token?: string }
 * Query: ?token= — alternatywa dla registration_token w body
 */
export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const queryToken = request.nextUrl.searchParams.get("token");

    let participants: InsuranceScopeParticipant[] | null = null;
    let bodyToken: string | undefined;
    try {
      const body = (await request.json()) as {
        participants?: InsuranceScopeParticipant[];
        registration_token?: string;
      };
      if (Array.isArray(body?.participants)) {
        participants = body.participants;
      }
      bodyToken = body?.registration_token;
    } catch {
      participants = null;
    }

    const token = queryToken ?? bodyToken ?? null;
    const admin = createAdminClient();
    const supabase = await createClient();

    const access = await assertRegistrationAccessWithBypass(
      admin,
      supabase,
      slug,
      token,
    );
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: registrationAccessErrorStatus(access.error) },
      );
    }

    const trip = access.trip;
    const { data: tripExtras } = await admin
      .from("trips")
      .select("form_extra_insurances")
      .eq("id", trip.id)
      .maybeSingle<{ form_extra_insurances: unknown }>();

    const formExtraInsurances = tripExtras?.form_extra_insurances ?? null;
    const hasParticipants = Boolean(participants && participants.length > 0);

    const scope = await buildInsuranceScope(
      admin,
      trip.id,
      hasParticipants ? participants : null,
      formExtraInsurances,
      hasParticipants ? undefined : { includeAvailableExtras: true },
    );

    return NextResponse.json({ scope });
  } catch (err) {
    console.error("Error in POST /api/trips/by-slug/[slug]/insurance-scope:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}
