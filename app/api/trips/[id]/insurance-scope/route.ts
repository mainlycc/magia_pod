import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTrip } from "@/lib/trips/can-manage-trip";
import { buildInsuranceScope } from "@/lib/agreement-insurance-scope";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const allowed = await canManageTrip(supabase, id);
    if (!allowed) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: tripRow } = await admin
      .from("trips")
      .select("form_extra_insurances")
      .eq("id", id)
      .maybeSingle();

    const scope = await buildInsuranceScope(
      admin,
      id,
      null,
      tripRow?.form_extra_insurances,
    );

    return NextResponse.json({ scope });
  } catch (err) {
    console.error("Error in GET /api/trips/[id]/insurance-scope:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}
