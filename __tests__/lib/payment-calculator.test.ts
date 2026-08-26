import {
  calculateBookingTotalCents,
  calculateInstallmentAmounts,
  derivePaymentSplitFromSchedule,
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

  it("nie dolicza atrakcji EUR do kwoty płatności PLN", () => {
    const participants = [
      {
        selected_services: {
          diets: [{ price_cents: 1000 }],
          attractions: [{ price_cents: 9900, currency: "EUR", include_in_contract: true }],
        },
      },
    ];
    expect(calculateBookingTotalCents(100000, 1, participants)).toBe(101000);
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

  it("przy 1 racie 100% bierze całą kwotę jako pierwszą płatność", () => {
    const total = 100000;
    const result = calculateInstallmentAmounts(total, {
      payment_schedule: [{ installment_number: 1, percent: 100 }],
      payment_split_first_percent: 30,
    });
    expect(result.firstPercent).toBe(100);
    expect(result.firstPaymentCents).toBe(100000);
    expect(result.secondPaymentCents).toBe(0);
  });
});

describe("formatDepositAmountZloty", () => {
  it("formatuje zaliczkę w PLN", () => {
    expect(formatDepositAmountZloty(2043300, 30)).toBe("6129.90");
  });

  it("formatuje 100% jako całą kwotę", () => {
    expect(formatDepositAmountZloty(100000, 100)).toBe("1000.00");
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

  it("przy 1 racie 100% zwraca 100 mimo starego payment_split_first_percent=30", () => {
    expect(
      getFirstInstallmentPercent({
        payment_schedule: [{ installment_number: 1, percent: 100 }],
        payment_split_enabled: true,
        payment_split_first_percent: 30,
      }),
    ).toBe(100);
  });

  it("sortuje raty po installment_number", () => {
    expect(
      getFirstInstallmentPercent({
        payment_schedule: [
          { installment_number: 2, percent: 70 },
          { installment_number: 1, percent: 40 },
        ],
      }),
    ).toBe(40);
  });
});

describe("derivePaymentSplitFromSchedule", () => {
  it("1 rata → split wyłączony i 100%", () => {
    expect(
      derivePaymentSplitFromSchedule([{ installment_number: 1, percent: 100 }]),
    ).toEqual({
      payment_split_enabled: false,
      payment_split_first_percent: 100,
      payment_split_second_percent: 0,
    });
  });

  it("2 raty → split włączony z procentami z harmonogramu", () => {
    expect(
      derivePaymentSplitFromSchedule([
        { installment_number: 1, percent: 40 },
        { installment_number: 2, percent: 60 },
      ]),
    ).toEqual({
      payment_split_enabled: true,
      payment_split_first_percent: 40,
      payment_split_second_percent: 60,
    });
  });
});
