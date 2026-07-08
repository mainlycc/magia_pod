import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInsuranceOwuAdmin } from "@/lib/insurance-local/owu-auth";
import {
  isValidVariantAttachmentType,
  variantAttachmentPublicUrl,
} from "@/lib/insurance-local/variant-attachments";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("insurance_variant_attachments")
      .select("*")
      .eq("variant_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const adminClient = createAdminClient();
    const attachments = (data || []).map((attachment) => {
      const {
        data: { publicUrl },
      } = adminClient.storage.from("documents").getPublicUrl(attachment.file_name);

      return {
        ...attachment,
        url: publicUrl || variantAttachmentPublicUrl(attachment.file_name),
      };
    });

    return NextResponse.json(attachments);
  } catch (err) {
    console.error("GET /api/insurance-local/variants/[id]/attachments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: variantId } = await params;
    const supabase = await createClient();

    if (!(await checkInsuranceOwuAdmin(supabase))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data: variant, error: variantError } = await supabase
      .from("insurance_variants")
      .select("id")
      .eq("id", variantId)
      .single();

    if (variantError || !variant) {
      return NextResponse.json({ error: "variant_not_found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const attachmentTypeRaw = formData.get("attachment_type");
    const displayName = formData.get("display_name") as string | null;
    const attachmentType =
      typeof attachmentTypeRaw === "string" ? attachmentTypeRaw : String(attachmentTypeRaw ?? "");

    if (!file) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }

    if (!isValidVariantAttachmentType(attachmentType)) {
      return NextResponse.json({ error: "invalid_attachment_type" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === "documents");
    if (!bucketExists) {
      await adminClient.storage.createBucket("documents", {
        public: true,
        allowedMimeTypes: ["application/pdf"],
      });
    }

    const { data: existingOwu } =
      attachmentType === "owu"
        ? await supabase
            .from("insurance_variant_attachments")
            .select("id, file_name")
            .eq("variant_id", variantId)
            .eq("attachment_type", "owu")
            .maybeSingle()
        : { data: null };

    const fileName = `insurance-variants/${variantId}/${attachmentType}-${Date.now()}.pdf`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    let savedAttachment;

    if (existingOwu) {
      const { data, error: updateError } = await supabase
        .from("insurance_variant_attachments")
        .update({
          file_name: fileName,
          display_name: displayName || null,
        })
        .eq("id", existingOwu.id)
        .select()
        .single();

      if (updateError) {
        await adminClient.storage.from("documents").remove([fileName]);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      savedAttachment = data;

      if (existingOwu.file_name && existingOwu.file_name !== fileName) {
        try {
          await adminClient.storage.from("documents").remove([existingOwu.file_name]);
        } catch (removeError) {
          console.error("Error removing old attachment:", removeError);
        }
      }
    } else {
      const { count } = await supabase
        .from("insurance_variant_attachments")
        .select("id", { count: "exact", head: true })
        .eq("variant_id", variantId);

      const { data, error: insertError } = await supabase
        .from("insurance_variant_attachments")
        .insert({
          variant_id: variantId,
          attachment_type: attachmentType,
          file_name: fileName,
          display_name: displayName || null,
          sort_order: count ?? 0,
        })
        .select()
        .single();

      if (insertError) {
        await adminClient.storage.from("documents").remove([fileName]);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      savedAttachment = data;
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from("documents").getPublicUrl(fileName);

    return NextResponse.json({
      ...savedAttachment,
      url: publicUrl || variantAttachmentPublicUrl(fileName),
      success: true,
    });
  } catch (err) {
    console.error("POST /api/insurance-local/variants/[id]/attachments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
