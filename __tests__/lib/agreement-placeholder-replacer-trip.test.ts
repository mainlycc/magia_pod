import { describe, expect, it } from "@jest/globals";
import { replaceTripPlaceholders } from "@/lib/agreement-placeholder-replacer";
import type { TripContentData, TripFullData } from "@/contexts/trip-context";

const tripFullData: TripFullData = {
  id: "trip-1",
  title: "Costa Brava",
  slug: "costa-brava",
  description: null,
  start_date: "2026-07-01",
  end_date: "2026-07-08",
  price_cents: 250000,
  seats_total: 40,
  seats_reserved: 5,
  is_active: true,
  category: null,
  territorial_scope: null,
  country: null,
  locality: null,
  territorial_scope_2: null,
  country_2: null,
  locality_2: null,
  location: "Hiszpania",
  transport_mode: "LOTCZART",
  airport_codes: "WAW-BCN",
  is_public: true,
  public_slug: "costa-brava",
  registration_mode: "both",
  require_pesel: true,
  form_show_additional_services: true,
  company_participants_info: null,
  form_additional_attractions: null,
  form_diets: null,
  form_extra_insurances: null,
  form_required_participant_fields: null,
  form_required_contact_fields: null,
  payment_split_enabled: null,
  payment_split_first_percent: null,
  payment_split_second_percent: null,
  payment_reminder_enabled: null,
  payment_reminder_days_before: null,
  payment_schedule: null,
};

const tripContentData: TripContentData = {
  program_atrakcje: "",
  dodatkowe_swiadczenia: "Stare świadczenia",
  gallery_urls: [],
  intro_text: "",
  section_poznaj_title: "",
  section_poznaj_description: "",
  reservation_info_text: "",
  reservation_success_message: "",
  trip_info_text: "",
  baggage_text: "20 kg",
  weather_text: "",
  show_trip_info_card: true,
  show_baggage_card: true,
  show_weather_card: true,
  show_seats_left: false,
  included_in_price_text: "",
  additional_costs_text: "100 EUR",
  additional_service_text: "Wycieczka lokalna",
  reservation_number: "123456",
  duration_text: "8 dni",
  agreement_room_type: "Pokój 2-osobowy",
  agreement_meals_info: "HB",
  agreement_transfer_info: "Transfer lotnisko-hotel",
  additional_fields: [],
  public_middle_sections: null,
  public_right_sections: null,
  public_hidden_middle_sections: null,
  public_hidden_right_sections: null,
  public_hidden_additional_sections: null,
};

describe("replaceTripPlaceholders — pola umowy", () => {
  it("podstawia room_type, meals_info, transfer_info i insurance_scope", () => {
    const html =
      "{{room_type}} | {{meals_info}} | {{transfer_info}} | {{insurance_scope}} | {{baggage_info}} | {{additional_services}}";

    const out = replaceTripPlaceholders(html, tripFullData, tripContentData, {
      insuranceScope: "Ubezpieczenie podstawowe: AXA",
    });

    expect(out).toContain("Pokój 2-osobowy");
    expect(out).toContain("HB");
    expect(out).toContain("Transfer lotnisko-hotel");
    expect(out).toContain("Ubezpieczenie podstawowe: AXA");
    expect(out).toContain("20 kg");
    expect(out).toContain("Wycieczka lokalna");
    expect(out).not.toContain("Stare świadczenia");
  });
});

describe("replaceTripPlaceholders — terminy płatności", () => {
  const html =
    "Zaliczka do {{trip_deposit_deadline}} | Całość do {{trip_final_payment_deadline}}";

  it("bierze daty z harmonogramu (1. rata = zaliczka, ostatnia = całość)", () => {
    const out = replaceTripPlaceholders(
      html,
      {
        ...tripFullData,
        start_date: "2026-08-11",
        payment_schedule: [
          { installment_number: 1, percent: 30, due_date: "2026-07-01" },
          { installment_number: 2, percent: 70, due_date: "2026-07-28" },
        ],
      },
      tripContentData,
    );

    expect(out).toContain("01.07.2026");
    expect(out).toContain("28.07.2026");
  });

  it("gdy brak harmonogramu, nie pokazuje dwa razy tej samej daty", () => {
    const out = replaceTripPlaceholders(
      html,
      {
        ...tripFullData,
        start_date: "2026-08-11",
        payment_schedule: null,
      },
      tripContentData,
    );

    const deposit = out.match(/Zaliczka do (\S+)/)?.[1];
    const final = out.match(/Całość do (\S+)/)?.[1];

    expect(deposit).toBeTruthy();
    expect(final).toBeTruthy();
    // Najważniejsze: terminy zaliczki i całości nie mogą być identyczne.
    expect(deposit).not.toEqual(final);
    // Termin całości to 14 dni przed wyjazdem.
    expect(final).toBe("28.07.2026");
  });
});
