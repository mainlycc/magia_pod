import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkInsuranceOwuAdmin } from "@/lib/insurance-local/owu-auth";

type DefaultConfigRow = {
  variant_id: string;
  price_grosz: number | null;
  is_enabled: boolean;
};

type VariantRow = {
  id: string;
  type: number;
  name: string;
  provider: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const [variantsRes, defaultsRes] = await Promise.all([
      supabase
        .from("insurance_variants")
        .select("id, type, name, provider, description, is_default, is_active")
        .order("type", { ascending: true })
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("global_insurance_trip_defaults")
        .select("variant_id, price_grosz, is_enabled"),
    ]);

    if (variantsRes.error) {
      return NextResponse.json({ error: variantsRes.error.message }, { status: 500 });
    }
    if (defaultsRes.error) {
      return NextResponse.json({ error: defaultsRes.error.message }, { status: 500 });
    }

    const defaultsMap = new Map(
      (defaultsRes.data || []).map((row) => [row.variant_id, row]),
    );

    const items = ((variantsRes.data || []) as VariantRow[]).map((variant) => {
      const config = defaultsMap.get(variant.id);
      return {
        variant,
        price_grosz: config?.price_grosz ?? null,
        is_enabled: config?.is_enabled ?? false,
      };
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/insurance-local/trip-defaults error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    if (!(await checkInsuranceOwuAdmin(supabase))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : null;

    if (!items) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    for (const item of items) {
      if (!item?.variant_id || typeof item.variant_id !== "string") {
        return NextResponse.json({ error: "invalid_variant_id" }, { status: 400 });
      }
    }

    const variantIds = items.map((item: DefaultConfigRow) => item.variant_id);

    const { data: variants, error: variantsError } = await supabase
      .from("insurance_variants")
      .select("id, type")
      .in("id", variantIds);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }

    const variantTypeMap = new Map((variants || []).map((v) => [v.id, v.type]));

    const upsertRows = items.map((item: DefaultConfigRow) => {
      const variantType = variantTypeMap.get(item.variant_id);
      const priceGrosz =
        variantType === 1
          ? null
          : typeof item.price_grosz === "number"
            ? item.price_grosz
            : null;

      return {
        variant_id: item.variant_id,
        price_grosz: priceGrosz,
        is_enabled: Boolean(item.is_enabled),
      };
    });

    const { error: upsertError } = await supabase
      .from("global_insurance_trip_defaults")
      .upsert(upsertRows, { onConflict: "variant_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/insurance-local/trip-defaults error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
