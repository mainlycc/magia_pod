import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("is_active").eq("id", id).single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { error } = await supabase.from("trips").update({ is_active: !trip.is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.redirect(new URL(`/admin/trips`, process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"));
}


