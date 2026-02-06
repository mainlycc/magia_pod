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

    // Pobierz szablony umów dla wycieczki
    const { data: templates, error } = await supabase
      .from("trip_agreement_templates")
      .select("registration_type, template_html")
      .eq("trip_id", id);

    if (error) {
      console.error("Error fetching agreement templates:", error);
      return NextResponse.json({ error: "fetch_failed", details: error.message }, { status: 500 });
    }

    // Zwróć jako obiekt z kluczami individual i company
    const result: { individual: string | null; company: string | null } = {
      individual: null,
      company: null,
    };

    if (templates) {
      templates.forEach((template) => {
        if (template.registration_type === "individual") {
          result.individual = template.template_html || null;
        } else if (template.registration_type === "company") {
          result.company = template.template_html || null;
        }
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in GET /api/trips/[id]/agreement-templates:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
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
    const { registration_type, template_html } = body as {
      registration_type: "individual" | "company";
      template_html: string;
    };

    if (!registration_type || !["individual", "company"].includes(registration_type)) {
      return NextResponse.json({ error: "invalid_registration_type" }, { status: 400 });
    }

    if (typeof template_html !== "string") {
      return NextResponse.json({ error: "invalid_template_html" }, { status: 400 });
    }

    // Sprawdź czy szablon już istnieje
    const { data: existing, error: checkError } = await supabase
      .from("trip_agreement_templates")
      .select("id")
      .eq("trip_id", id)
      .eq("registration_type", registration_type)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing template:", checkError);
      return NextResponse.json({ error: "check_failed", details: checkError.message }, { status: 500 });
    }

    if (existing) {
      // Aktualizuj istniejący szablon
      const { error: updateError } = await supabase
        .from("trip_agreement_templates")
        .update({
          template_html: template_html,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating agreement template:", updateError);
        return NextResponse.json({ error: "update_failed", details: updateError.message }, { status: 500 });
      }
    } else {
      // Utwórz nowy szablon
      const { error: insertError } = await supabase
        .from("trip_agreement_templates")
        .insert({
          trip_id: id,
          registration_type: registration_type,
          template_html: template_html,
        });

      if (insertError) {
        console.error("Error inserting agreement template:", insertError);
        return NextResponse.json({ error: "insert_failed", details: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in PATCH /api/trips/[id]/agreement-templates:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}
