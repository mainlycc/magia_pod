import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      slug,
      description,
      start_date,
      end_date,
      price_cents,
      seats_total,
      is_active,
      category,
      location,
      is_public,
      public_slug,
    } = body ?? {};
    if (!title || !slug) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const supabase = await createClient();
    
    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("trips")
      .insert({
        title,
        slug,
        description: description ?? null,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        price_cents: typeof price_cents === "number" ? price_cents : null,
        seats_total: typeof seats_total === "number" ? seats_total : 0,
        is_active: is_active ?? true,
        is_public: Boolean(is_public),
        public_slug: public_slug ?? null,
        category: category ?? null,
        location: location ?? null,
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("Error inserting trip:", error);
      return NextResponse.json({ error: "insert_failed", details: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("Error in POST /api/trips:", err);
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}


