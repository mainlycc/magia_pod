import type { Page } from "@playwright/test";

/** Stałe ID i slug muszą być spójne z mockiem — strona `/trip/[slug]/reserve` używa slug z URL. */
export const MOCK_TRIP_ID = "00000000-0000-4000-8000-000000000099";
export const MOCK_TRIP_SLUG = "e2e-form-config";

export type TripMockOverrides = {
  registration_mode?: "both" | "individual" | "company";
  require_pesel?: boolean;
  form_show_additional_services?: boolean;
  form_required_contact_fields?: {
    pesel?: boolean;
    phone?: boolean;
    email?: boolean;
    address?: boolean;
  } | null;
  form_required_participant_fields?: {
    gender?: boolean;
    phone?: boolean;
    document?: boolean;
    pesel?: boolean;
  } | null;
};

/**
 * Pełny wiersz `trips` zwracany z PostgREST — kilka zapytań (slug, id, pola content)
 * korzysta z tej samej tabeli; jeden obiekt z nadmiarowymi kolumnami działa dla wszystkich.
 */
export function buildMockTripRow(overrides: TripMockOverrides = {}) {
  const contactDefaults = {
    pesel: false,
    phone: true,
    email: true,
    address: false,
  };
  const mergedContact =
    overrides.form_required_contact_fields === null
      ? null
      : {
          ...contactDefaults,
          ...overrides.form_required_contact_fields,
        };

  return {
    id: MOCK_TRIP_ID,
    title: "Wycieczka E2E (mock)",
    slug: MOCK_TRIP_SLUG,
    public_slug: null,
    description: "Mock opisu",
    start_date: "2026-07-01",
    end_date: "2026-07-08",
    price_cents: 100000,
    seats_total: 30,
    seats_reserved: 5,
    is_active: true,
    is_public: true,
    location: "Mock",
    transport_mode: null,
    airport_codes: null,
    category: null,
    registration_mode: overrides.registration_mode ?? "individual",
    require_pesel: overrides.require_pesel ?? false,
    form_show_additional_services: overrides.form_show_additional_services ?? false,
    company_participants_info: null,
    payment_split_enabled: true,
    payment_split_first_percent: 30,
    payment_split_second_percent: null,
    payment_reminder_enabled: null,
    payment_reminder_days_before: null,
    payment_schedule: null,
    form_additional_attractions: [],
    form_diets: [],
    form_extra_insurances: [],
    form_required_participant_fields: overrides.form_required_participant_fields ?? null,
    form_required_contact_fields: mergedContact,
    reservation_info_text: null,
    reservation_success_message: null,
    program_atrakcje: "",
    dodatkowe_swiadczenia: "",
    reservation_number: "",
    duration_text: "",
    additional_costs_text: "",
  };
}

/**
 * Przechwytuje wywołania klienta Supabase do `trips` oraz pomocnicze API Next,
 * żeby testy nie zależały od bazy i projektu Supabase.
 */
export async function installTripMocks(page: Page, tripRow: Record<string, unknown>) {
  const tripId = String(tripRow.id);

  /* Bez tego drugie wywołanie w jednym teście nie działa — pierwsza zarejestrowana trasa wygrywa */
  await page.unroute("**/rest/v1/trips**");
  await page.unroute(`**/api/documents/trip/${tripId}**`);
  await page.unroute("**/api/documents/trip/**");
  await page.unroute("**/api/trips/by-slug/**/agreement-templates**");

  await page.route("**/rest/v1/trips**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      await route.continue();
      return;
    }
    if (req.method() === "HEAD") {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-range": "0-0/1",
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-range": "0-0/1",
      },
      body: JSON.stringify([tripRow]),
    });
  });

  await page.route(`**/api/documents/trip/${tripId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.route("**/api/trips/by-slug/**/agreement-templates**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ individual: null, company: null }),
    });
  });
}
