import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInsuranceOwuAdmin } from "@/lib/insurance-local/owu-auth";
import { isValidInsuranceOwuType } from "@/lib/insurance-local/owu-constants";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    if (!(await checkInsuranceOwuAdmin(supabase))) {
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

    const adminClient = createAdminClient();
    const { data: saved, error: upsertError } = await adminClient
      .from("global_insurance_owu_email_settings")
      .upsert(
        {
          insurance_type: insuranceType,
          attach_on_reservation: attachOnReservation,
        },
        { onConflict: "insurance_type" },
      )
      .select("insurance_type, attach_on_reservation")
      .single();

    if (upsertError) {
      console.error("PATCH global insurance OWU email-settings upsert error:", upsertError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error("PATCH /api/insurance-local/owu/global/email-settings error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
