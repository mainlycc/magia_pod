import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidInsuranceOwuType } from "@/lib/insurance-local/owu-constants";
import { canManageInsuranceOwu } from "@/lib/insurance-local/owu-auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;
    const supabase = await createClient();

    if (!(await canManageInsuranceOwu(supabase, tripId))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const insuranceTypeRaw = body?.insurance_type;
    const insuranceType =
      typeof insuranceTypeRaw === "string" ? parseInt(insuranceTypeRaw, 10) : insuranceTypeRaw;
    const attachOnReservation = body?.attach_on_reservation;

    if (!isValidInsuranceOwuType(insuranceType)) {
      return NextResponse.json({ error: "invalid_insurance_type" }, { status: 400 });
    }

    if (typeof attachOnReservation !== "boolean") {
      return NextResponse.json({ error: "invalid_attach_on_reservation" }, { status: 400 });
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    const adminClient = createAdminClient();
    const { data: saved, error: upsertError } = await adminClient
      .from("trip_insurance_owu_email_settings")
      .upsert(
        {
          trip_id: tripId,
          insurance_type: insuranceType,
          attach_on_reservation: attachOnReservation,
        },
        { onConflict: "trip_id,insurance_type" },
      )
      .select("insurance_type, attach_on_reservation")
      .single();

    if (upsertError) {
      console.error("PATCH insurance OWU email-settings upsert error:", upsertError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error("PATCH /api/insurance-local/owu/trip/[tripId]/email-settings error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
