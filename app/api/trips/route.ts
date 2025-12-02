import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}


