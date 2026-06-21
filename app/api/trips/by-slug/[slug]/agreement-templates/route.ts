import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COMPANY_SECTION_HTML = `
<h2>Dane firmy</h2>
<table>
  <tr>
    <td>Nazwa firmy:</td>
    <td>{{company_name}}</td>
  </tr>
  <tr>
    <td>NIP/KRS:</td>
    <td>{{company_nip}}</td>
  </tr>
  <tr>
    <td>Adres firmy:</td>
    <td>{{company_address}}</td>
  </tr>
</table>
`.trim();

function hasCompanyPlaceholders(html: string): boolean {
  return (
    html.includes("{{company_name}}") &&
    html.includes("{{company_nip}}") &&
    html.includes("{{company_address}}")
  );
}

function injectCompanySection(html: string): string {
  if (hasCompanyPlaceholders(html)) return html;

  // Best-effort: wstaw przed sekcją „Dane uczestników”, jeśli istnieje w HTML
  const anchors = [
    "<h2>Dane uczestników</h2>",
    "<h2>Dane uczestnik\u00F3w</h2>",
    "<h2>Dane Uczestników</h2>",
    "<h2>Dane Uczestnik\u00F3w</h2>",
  ];

  for (const a of anchors) {
    const idx = html.indexOf(a);
    if (idx !== -1) {
      const before = html.slice(0, idx).trimEnd();
      const after = html.slice(idx);
      return `${before}\n\n${COMPANY_SECTION_HTML}\n\n${after}`;
    }
  }

  // Fallback: dopnij na końcu
  return `${html.trimEnd()}\n\n${COMPANY_SECTION_HTML}\n`;
}

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

    // Szablony: odczyt service role — publiczna strona rezerwacji nie ma sesji authenticated,
    // a RLS na trip_agreement_templates wymaga zalogowania przy createClient().
    const admin = createAdminClient();
    const { data: templates, error } = await admin
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

    // Auto-uzupełnienie dla starszych szablonów firmowych bez sekcji firmy.
    // Dzięki temu podgląd umowy (reserve) i PDF dla firm pokażą dane firmy nawet,
    // jeśli w DB zapisano template bez placeholderów.
    if (typeof result.company === "string" && result.company.trim() !== "") {
      result.company = injectCompanySection(result.company);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error in GET /api/trips/by-slug/[slug]/agreement-templates:", err);
    return NextResponse.json({ error: "internal_error", details: String(err) }, { status: 500 });
  }
}
