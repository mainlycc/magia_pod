import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    // Najpierw znajdź wycieczkę po slug
    let { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, is_active, is_public")
      .eq("slug", slug)
      .maybeSingle();

    // Jeśli nie znaleziono, spróbuj public_slug
    if (!trip && !tripError) {
      const { data: tripByPublicSlug, error: errorByPublicSlug } = await supabase
        .from("trips")
        .select("id, is_active, is_public")
        .eq("public_slug", slug)
        .maybeSingle();
      
      if (tripByPublicSlug) {
        trip = tripByPublicSlug;
      } else {
        tripError = errorByPublicSlug;
      }
    }

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    // Sprawdź czy wycieczka jest aktywna i publiczna
    if (!trip.is_active || !trip.is_public) {
      return NextResponse.json({ error: "trip_not_available" }, { status: 403 });
    }

    // Pobierz szablony umów dla wycieczki
    const { data: templates, error } = await supabase
      .from("trip_agreement_templates")
      .select("registration_type, template_html")
      .eq("trip_id", trip.id);

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
    console.error("Error in GET /api/trips/by-slug/[slug]/agreement-templates:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}
