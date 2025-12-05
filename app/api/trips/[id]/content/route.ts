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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .select("program_atrakcje, dodatkowe_swiadczenia, gallery_urls, intro_text, section_poznaj_title, section_poznaj_description, reservation_info_text")
      .eq("id", id)
      .single();

    if (error || !trip) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      program_atrakcje: trip.program_atrakcje || "",
      dodatkowe_swiadczenia: trip.dodatkowe_swiadczenia || "",
      gallery_urls: trip.gallery_urls || [],
      intro_text: trip.intro_text || "",
      section_poznaj_title: trip.section_poznaj_title || "",
      section_poznaj_description: trip.section_poznaj_description || "",
      reservation_info_text: trip.reservation_info_text || "",
    });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      program_atrakcje, 
      dodatkowe_swiadczenia, 
      gallery_urls,
      intro_text,
      section_poznaj_title,
      section_poznaj_description,
      reservation_info_text
    } = body as {
      program_atrakcje?: string;
      dodatkowe_swiadczenia?: string;
      gallery_urls?: string[];
      intro_text?: string;
      section_poznaj_title?: string;
      section_poznaj_description?: string;
      reservation_info_text?: string;
    };

    const updateData: {
      program_atrakcje?: string | null;
      dodatkowe_swiadczenia?: string | null;
      gallery_urls?: string[];
      intro_text?: string | null;
      section_poznaj_title?: string | null;
      section_poznaj_description?: string | null;
      reservation_info_text?: string | null;
    } = {};

    if ("program_atrakcje" in body) {
      updateData.program_atrakcje = program_atrakcje ?? null;
    }
    if ("dodatkowe_swiadczenia" in body) {
      updateData.dodatkowe_swiadczenia = dodatkowe_swiadczenia ?? null;
    }
    if ("gallery_urls" in body && Array.isArray(gallery_urls)) {
      updateData.gallery_urls = gallery_urls;
    }
    if ("intro_text" in body) {
      updateData.intro_text = intro_text ?? null;
    }
    if ("section_poznaj_title" in body) {
      updateData.section_poznaj_title = section_poznaj_title ?? null;
    }
    if ("section_poznaj_description" in body) {
      updateData.section_poznaj_description = section_poznaj_description ?? null;
    }
    if ("reservation_info_text" in body) {
      updateData.reservation_info_text = reservation_info_text ?? null;
    }

    const { error } = await supabase.from("trips").update(updateData).eq("id", id);

    if (error) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

