import { countsTowardPaidAmount } from "@/lib/bookings/payment-history-counts";

describe("countsTowardPaidAmount", () => {
  it("liczy ręczne wpłaty", () => {
    expect(
      countsTowardPaidAmount({
        payment_method: "manual",
        notes: "Ręczna wpłata",
        amount_cents: 10000,
      }),
    ).toBe(true);
  });

  it("liczy Paynow CONFIRMED", () => {
    expect(
      countsTowardPaidAmount({
        payment_method: "paynow",
        notes: "Paynow payment ABC - status: CONFIRMED",
        amount_cents: 50000,
      }),
    ).toBe(true);
  });

  it("nie liczy Paynow PENDING", () => {
    expect(
      countsTowardPaidAmount({
        payment_method: "paynow",
        notes: "Paynow payment ABC - status: PENDING (initialized) - zaliczka 30%",
        amount_cents: 50000,
      }),
    ).toBe(false);
  });
});
