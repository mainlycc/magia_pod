import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInsuranceOwuAdmin } from "@/lib/insurance-local/owu-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const { id: variantId, attachmentId } = await params;
    const supabase = await createClient();

    if (!(await checkInsuranceOwuAdmin(supabase))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data: attachment, error: fetchError } = await supabase
      .from("insurance_variant_attachments")
      .select("id, file_name, variant_id")
      .eq("id", attachmentId)
      .eq("variant_id", variantId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("insurance_variant_attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const adminClient = createAdminClient();
    try {
      await adminClient.storage.from("documents").remove([attachment.file_name]);
    } catch (storageError) {
      console.error("Error removing attachment file:", storageError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/insurance-local/variants/[id]/attachments/[attachmentId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
