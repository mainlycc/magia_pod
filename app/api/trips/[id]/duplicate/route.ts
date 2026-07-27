import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { duplicateTripFull } from "@/lib/trips/duplicate-trip";

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

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const result = await duplicateTripFull(adminClient, id);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected";
    if (message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("Error in POST /api/trips/[id]/duplicate:", err);
    return NextResponse.json({ error: "duplicate_failed" }, { status: 500 });
  }
}
