import {
  calculateBookingTotalCents,
  calculateInstallmentAmounts,
  formatDepositAmountZloty,
  getFirstInstallmentPercent,
} from "@/lib/utils/payment-calculator";

describe("calculateBookingTotalCents", () => {
  it("dodaje dopłaty za usługi do bazy × osoby", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ price_cents: 43300 }],
        },
      },
    ];
    // 20000 PLN/os. + 433 PLN dopłata
    expect(calculateBookingTotalCents(2000000, 1, participants)).toBe(2043300);
  });
});

describe("calculateInstallmentAmounts", () => {
  it("liczy zaliczkę z procentu pierwszej raty", () => {
    const total = 2043300;
    const { firstPaymentCents, secondPaymentCents } = calculateInstallmentAmounts(total, {
      payment_split_enabled: true,
      payment_split_first_percent: 30,
    });
    expect(firstPaymentCents).toBe(612990);
    expect(secondPaymentCents).toBe(total - firstPaymentCents);
  });
});

describe("formatDepositAmountZloty", () => {
  it("formatuje zaliczkę w PLN", () => {
    expect(formatDepositAmountZloty(2043300, 30)).toBe("6129.90");
  });
});

describe("getFirstInstallmentPercent", () => {
  it("bierze procent z harmonogramu gdy jest ustawiony", () => {
    expect(
      getFirstInstallmentPercent({
        payment_schedule: [{ percent: 50 }],
        payment_split_first_percent: 30,
      }),
    ).toBe(50);
  });
});
