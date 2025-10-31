import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("title,slug,description,start_date,end_date,price_cents,seats_total,is_active")
    .eq("id", id)
    .single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const newSlug = `${trip.slug}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("trips").insert({
    title: `${trip.title} (kopiuj)`,
    slug: newSlug,
    description: trip.description,
    start_date: trip.start_date,
    end_date: trip.end_date,
    price_cents: trip.price_cents,
    seats_total: trip.seats_total,
    is_active: false,
  });
  if (error) return NextResponse.json({ error: "duplicate_failed" }, { status: 500 });
  return NextResponse.redirect(new URL(`/admin/trips`, process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}


