import {
  calculateBookingAmountDueCents,
  deriveInstallmentStatuses,
  derivePaymentStatus,
} from "@/lib/bookings/recalculate-booking-payments";

describe("derivePaymentStatus", () => {
  it("zwraca unpaid gdy brak wpłaty", () => {
    expect(derivePaymentStatus(0, 100000)).toBe("unpaid");
  });

  it("zwraca partial gdy wpłata < należność", () => {
    expect(derivePaymentStatus(50000, 100000)).toBe("partial");
  });

  it("zwraca paid gdy wpłata = należność (z usługami)", () => {
    expect(derivePaymentStatus(220000, 220000)).toBe("paid");
  });

  it("zwraca overpaid gdy wpłata > należność", () => {
    expect(derivePaymentStatus(230000, 220000)).toBe("overpaid");
  });
});

describe("calculateBookingAmountDueCents", () => {
  it("liczy cenę × osoby + usługi dodatkowe", () => {
    const due = calculateBookingAmountDueCents(
      { price_cents: 200000 },
      [
        {
          is_active: true,
          selected_services: { diets: [{ price_cents: 20000 }] },
        },
        {
          is_active: true,
          selected_services: {},
        },
      ],
    );
    // 2 × 200000 + 20000
    expect(due).toBe(420000);
  });

  it("pomija nieaktywnych uczestników", () => {
    const due = calculateBookingAmountDueCents(
      { price_cents: 100000 },
      [
        { is_active: true, selected_services: { diets: [{ price_cents: 5000 }] } },
        { is_active: false, selected_services: { diets: [{ price_cents: 99999 }] } },
      ],
    );
    expect(due).toBe(105000);
  });

  it("przy pełnej wpłacie za osoby+usługi status jest paid, nie overpaid", () => {
    const participants = [
      {
        is_active: true,
        selected_services: { insurances: [{ price_cents: 15000 }] },
      },
    ];
    const due = calculateBookingAmountDueCents({ price_cents: 100000 }, participants);
    expect(due).toBe(115000);
    expect(derivePaymentStatus(115000, due)).toBe("paid");
    // Stara błędna logika (tylko cena 1 osoby) dałaby overpaid:
    expect(derivePaymentStatus(115000, 100000)).toBe("overpaid");
  });
});

describe("deriveInstallmentStatuses", () => {
  it("uznaje drugą ratę za zapłaconą przy pełnej należności z usługami", () => {
    const amountDue = 115000;
    const statuses = deriveInstallmentStatuses(115000, amountDue, 30000, 85000);
    expect(statuses.first_payment_status).toBe("paid");
    expect(statuses.second_payment_status).toBe("paid");
  });

  it("nie uznaje drugiej raty przy wpłacie tylko za cenę wycieczki gdy są usługi", () => {
    const amountDue = 115000;
    const statuses = deriveInstallmentStatuses(100000, amountDue, 30000, 85000);
    expect(statuses.first_payment_status).toBe("paid");
    expect(statuses.second_payment_status).toBe("unpaid");
  });
});
