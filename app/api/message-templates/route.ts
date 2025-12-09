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

    // Pobierz wszystkie szablony, posortowane po dacie utworzenia (najnowsze na górze)
    const { data: templates, error } = await supabase
      .from("message_templates")
      .select("id, title, subject, body, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load message templates:", error);
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    return NextResponse.json(templates || []);
  } catch (error) {
    console.error("Error fetching message templates:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

