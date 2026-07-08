import { sumAdditionalServicesCents, sumFormParticipantServicesCents, resolveAdditionalServicesCents } from "@/lib/sum-additional-services-cents";

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

  it("zwraca 0 dla pustej tablicy lub braku cen", () => {
    expect(sumAdditionalServicesCents([])).toBe(0);
    expect(sumAdditionalServicesCents([{}])).toBe(0);
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
