import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("id,title,slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload: Partial<{ title: string; price_cents: number; seats_total: number }> = {};
    if ("title" in body) payload.title = body.title;
    if ("price_cents" in body) payload.price_cents = body.price_cents;
    if ("seats_total" in body) payload.seats_total = body.seats_total;

    const supabase = await createClient();
    const { error } = await supabase.from("trips").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}


