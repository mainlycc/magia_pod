import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInsuranceOwuAdmin } from "@/lib/insurance-local/owu-auth";
import { isValidInsuranceOwuType } from "@/lib/insurance-local/owu-constants";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  try {
    const { type: typeParam } = await context.params;
    const insuranceType = parseInt(typeParam, 10);
    const supabase = await createClient();

    if (!(await checkInsuranceOwuAdmin(supabase))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    if (!isValidInsuranceOwuType(insuranceType)) {
      return NextResponse.json({ error: "invalid_insurance_type" }, { status: 400 });
    }

    const { data: document, error: fetchError } = await supabase
      .from("global_insurance_owu_documents")
      .select("file_name")
      .eq("insurance_type", insuranceType)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("global_insurance_owu_documents")
      .delete()
      .eq("insurance_type", insuranceType);

    if (deleteError) {
      console.error("Database delete error:", deleteError);
      return NextResponse.json({ error: "database_error" }, { status: 500 });
    }

    const adminClient = createAdminClient();
    try {
      await adminClient.storage.from("documents").remove([document.file_name]);
    } catch (storageError) {
      console.error("Error removing file from storage:", storageError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/insurance-local/owu/global/[type] error", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
