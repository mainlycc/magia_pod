import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Helper do sprawdzenia czy użytkownik to admin
async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("is_active");

    let query = supabase.from("insurance_products").select("*").order("created_at", { ascending: false });

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching products:", error);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, variant_code, is_default, is_active } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Jeśli ustawiamy jako domyślny, usuń domyślny status z innych produktów
    if (is_default) {
      await supabase
        .from("insurance_products")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("insurance_products")
      .insert({
        code,
        name,
        variant_code: variant_code || null,
        is_default: is_default || false,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      return NextResponse.json({ error: "create_failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: data });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected", message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, code, name, variant_code, is_default, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    // Jeśli ustawiamy jako domyślny, usuń domyślny status z innych produktów
    if (is_default) {
      await supabase
        .from("insurance_products")
        .update({ is_default: false })
        .eq("is_default", true)
        .neq("id", id);
    }

    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (variant_code !== undefined) updateData.variant_code = variant_code;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from("insurance_products")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating product:", error);
      return NextResponse.json({ error: "update_failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: data });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "unexpected", message: err.message }, { status: 500 });
  }
}

