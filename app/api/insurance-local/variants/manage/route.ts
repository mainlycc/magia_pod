import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { variantAttachmentPublicUrl } from "@/lib/insurance-local/variant-attachments";

type VariantRow = {
  id: string;
  type: number;
  name: string;
  provider: string;
  description: string | null;
  coverage_scope: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  variant_id: string;
  attachment_type: "owu" | "other";
  file_name: string;
  display_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type DefaultRow = {
  variant_id: string;
  price_grosz: number | null;
  is_enabled: boolean;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const adminClient = createAdminClient();

    const [variantsRes, attachmentsRes, defaultsRes] = await Promise.all([
      supabase
        .from("insurance_variants")
        .select("*")
        .order("type", { ascending: true })
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("insurance_variant_attachments")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("global_insurance_trip_defaults").select("variant_id, price_grosz, is_enabled"),
    ]);

    if (variantsRes.error) {
      return NextResponse.json({ error: variantsRes.error.message }, { status: 500 });
    }
    if (attachmentsRes.error) {
      return NextResponse.json({ error: attachmentsRes.error.message }, { status: 500 });
    }
    if (defaultsRes.error) {
      return NextResponse.json({ error: defaultsRes.error.message }, { status: 500 });
    }

    const attachmentsByVariant = new Map<string, AttachmentRow[]>();
    for (const attachment of (attachmentsRes.data || []) as AttachmentRow[]) {
      const list = attachmentsByVariant.get(attachment.variant_id) || [];
      list.push(attachment);
      attachmentsByVariant.set(attachment.variant_id, list);
    }

    const defaultsMap = new Map(
      ((defaultsRes.data || []) as DefaultRow[]).map((row) => [row.variant_id, row]),
    );

    const variants = ((variantsRes.data || []) as VariantRow[]).map((variant) => {
      const attachments = (attachmentsByVariant.get(variant.id) || []).map((attachment) => {
        const {
          data: { publicUrl },
        } = adminClient.storage.from("documents").getPublicUrl(attachment.file_name);

        return {
          ...attachment,
          url: publicUrl || variantAttachmentPublicUrl(attachment.file_name),
        };
      });

      const tripDefault = defaultsMap.get(variant.id);

      return {
        ...variant,
        attachments,
        trip_default: tripDefault
          ? {
              price_grosz: tripDefault.price_grosz,
              is_enabled: tripDefault.is_enabled,
            }
          : {
              price_grosz: null,
              is_enabled: false,
            },
      };
    });

    return NextResponse.json({ variants });
  } catch (err) {
    console.error("GET /api/insurance-local/variants/manage error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
