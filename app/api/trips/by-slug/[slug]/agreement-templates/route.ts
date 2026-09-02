import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  assertRegistrationAccessWithBypass,
  registrationAccessErrorStatus,
} from "@/lib/trips/registration-access";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const token = request.nextUrl.searchParams.get("token");
    const admin = createAdminClient();
    const supabase = await createClient();

    const access = await assertRegistrationAccessWithBypass(
      admin,
      supabase,
      slug,
      token,
    );
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: registrationAccessErrorStatus(access.error) },
      );
    }

    const trip = access.trip;
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
