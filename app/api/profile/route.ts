import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, allowed_trip_ids")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}


