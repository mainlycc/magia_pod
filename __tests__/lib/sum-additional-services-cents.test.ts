import {
  sumAdditionalServicesCents,
  sumFormParticipantServicesCents,
  resolveAdditionalServicesCents,
  sumAdditionalServicesCentsUsingCatalogs,
  collectForeignCurrencyAttractionLines,
} from "@/lib/sum-additional-services-cents";

describe("sumAdditionalServicesCents", () => {
  it("sumuje dietę, ubezpieczenie i atrakcję z wyłączeniem include_in_contract=false", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ price_cents: 1000 }],
          insurances: [{ price_cents: 2000 }],
          attractions: [
            { price_cents: 3000, include_in_contract: true },
            { price_cents: 99999, include_in_contract: false },
          ],
        },
      },
    ];
    expect(sumAdditionalServicesCents(participants)).toBe(6000);
  });

  it("pomija atrakcje w walucie obcej (EUR) w sumie PLN", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ price_cents: 1000 }],
          attractions: [
            { price_cents: 5000, currency: "EUR", include_in_contract: true },
            { price_cents: 2000, currency: "PLN", include_in_contract: true },
          ],
        },
      },
    ];
    expect(sumAdditionalServicesCents(participants)).toBe(3000);
  });

  it("zwraca 0 dla pustej tablicy lub braku cen", () => {
    expect(sumAdditionalServicesCents([])).toBe(0);
    expect(sumAdditionalServicesCents([{}])).toBe(0);
  });
});

describe("sumAdditionalServicesCentsUsingCatalogs", () => {
  it("pomija atrakcje EUR nawet gdy snapshot nie ma currency (bierze z katalogu)", () => {
    const catalogs = {
      form_additional_attractions: [
        { id: "attr-eur", title: "Rejs", price_cents: 5000, currency: "EUR" },
        { id: "attr-pln", title: "Muzeum", price_cents: 1500, currency: "PLN" },
      ],
    };
    const participants = [
      {
        selected_services: {
          attractions: [
            { service_id: "attr-eur", include_in_contract: true },
            { service_id: "attr-pln", include_in_contract: true },
          ],
        },
      },
    ];
    expect(sumAdditionalServicesCentsUsingCatalogs(participants, catalogs)).toBe(1500);
  });
});

describe("collectForeignCurrencyAttractionLines", () => {
  it("zbiera atrakcje nie-PLN do osobnego wyświetlenia", () => {
    const catalogs = {
      form_additional_attractions: [
        { id: "attr-eur", title: "Rejs", price_cents: 5000, currency: "EUR" },
      ],
    };
    const participants = [
      {
        selected_services: {
          attractions: [{ service_id: "attr-eur", price_cents: 5000, currency: "EUR" }],
        },
      },
    ];
    expect(collectForeignCurrencyAttractionLines(participants, catalogs)).toEqual([
      {
        price_cents: 5000,
        currency: "EUR",
        service_id: "attr-eur",
        title: "Rejs",
      },
    ]);
  });
});

describe("sumFormParticipantServicesCents", () => {
  it("sumuje usługi PLN z formularza i pomija inne waluty oraz atrakcje poza umową", () => {
    const services = [
      { type: "diet", price_cents: 1000, currency: "PLN" },
      { type: "attraction", price_cents: 2000, currency: "EUR" },
      { type: "attraction", price_cents: 3000, currency: "PLN", include_in_contract: false },
      { type: "insurance", price_cents: 4000, currency: "PLN" },
    ];
    expect(sumFormParticipantServicesCents(services)).toBe(5000);
  });
});

describe("resolveAdditionalServicesCents", () => {
  it("bierze dopłaty z participant_services gdy uczestnicy nie mają selected_services", () => {
    const participants = [{ first_name: "Jan", last_name: "Kowalski" }];
    const services = [{ type: "diet", price_cents: 2500, currency: "PLN" }];
    expect(resolveAdditionalServicesCents(participants, services)).toBe(2500);
  });

  it("używa jawnej wartości gdy przekazano addonTotalCents", () => {
    expect(resolveAdditionalServicesCents([], [{ price_cents: 9999 }], 1200)).toBe(1200);
  });
});
