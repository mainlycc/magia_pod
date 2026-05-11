import { replaceBookingPlaceholders } from "@/lib/agreement-placeholder-replacer";

describe("replaceBookingPlaceholders — ceny z dopłatami", () => {
  it("uwzględnia addonTotalCents w trip_total_price i trip_deposit_amount", () => {
    const html = "{{trip_total_price}} {{trip_deposit_amount}}";
    const formData = {
      participants_count: 2,
      participants: [],
    };
    const tripPriceCents = 10000; // 100 PLN/os.
    const addonTotalCents = 5000; // 50 PLN łącznie dopłat
    // total = 20000 + 5000 = 25000 gr => 250.00 PLN; zaliczka 30% => 7500 gr => 75.00 PLN
    const out = replaceBookingPlaceholders(
      html,
      formData,
      tripPriceCents,
      null,
      addonTotalCents,
    );
    expect(out).toBe("250.00 75.00");
  });

  it("bez dopłat zachowuje dotychczasowe liczenie (tylko baza × osoby)", () => {
    const html = "{{trip_total_price}} {{trip_deposit_amount}}";
    const formData = { participants_count: 2, participants: [] };
    const tripPriceCents = 10000;
    const out = replaceBookingPlaceholders(html, formData, tripPriceCents, null);
    expect(out).toBe("200.00 60.00");
  });
});
