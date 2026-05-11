import { sumAdditionalServicesCents } from "@/lib/sum-additional-services-cents";

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
