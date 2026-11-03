import { describe, it, expect, beforeAll, beforeEach, jest } from "@jest/globals";

jest.mock("@/lib/paynow", () => ({
  createPaynowPayment: jest.fn(),
}));

const { createPaynowPayment } = jest.requireMock<{ createPaynowPayment: jest.Mock }>("@/lib/paynow");

let startSecondInstallmentPaynowPayment: typeof import("@/lib/payments/start-second-installment-payment").startSecondInstallmentPaynowPayment;
let buildSecondInstallmentIdempotencyKey: typeof import("@/lib/payments/start-second-installment-payment").buildSecondInstallmentIdempotencyKey;

beforeAll(async () => {
  ({ startSecondInstallmentPaynowPayment, buildSecondInstallmentIdempotencyKey } = await import(
    "@/lib/payments/start-second-installment-payment"
  ));
});

function bookingClient(booking: unknown) {
  const insert = jest.fn(() => Promise.resolve({ error: null }));
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(() => Promise.resolve({ data: booking, error: null }));
  const from = jest.fn((table: string) => {
    if (table === "payment_history") return { insert };
    return builder;
  });
  return { from, insert };
}

const unpaidBooking = {
  id: "booking-1",
  booking_ref: "BK-1",
  contact_email: "rodzic@example.com",
  access_token: "token-1",
  first_payment_status: "paid",
  second_payment_status: "unpaid",
  second_payment_amount_cents: 102900,
  payment_status: "partial",
  trips: { title: "Berlin XXL, 011026" },
};

describe("buildSecondInstallmentIdempotencyKey", () => {
  it("mieści się w limicie 45 znaków Paynow", () => {
    const key = buildSecondInstallmentIdempotencyKey("BK-MVFSDUM6-NZDAK");
    expect(key.length).toBeLessThanOrEqual(45);
    expect(key.startsWith("BK-MVFSDUM6-NZDAK-")).toBe(true);
  });
});

describe("startSecondInstallmentPaynowPayment", () => {
  beforeEach(() => {
    createPaynowPayment.mockReset();
  });

  it("tworzy płatność Paynow na kwotę drugiej raty i zwraca adres bramki", async () => {
    createPaynowPayment.mockResolvedValue({
      paymentId: "PAY-2",
      redirectUrl: "https://paywall.paynow.pl/payment/PAY-2",
    });
    const client = bookingClient(unpaidBooking);

    const result = await startSecondInstallmentPaynowPayment({
      adminClient: { from: client.from } as never,
      baseUrl: "https://app.magia-podrozowania.pl",
      accessToken: "token-1",
    });

    expect(result).toEqual({
      ok: true,
      redirectUrl: "https://paywall.paynow.pl/payment/PAY-2",
    });
    expect(createPaynowPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 102900,
        externalId: "BK-1",
        buyerEmail: "rodzic@example.com",
        continueUrl: "https://app.magia-podrozowania.pl/booking/token-1?fromPaynow=1",
        description: "Reszta - Rezerwacja BK-1 - Berlin XXL, 011026",
      }),
    );
    const idempotencyKey = createPaynowPayment.mock.calls[0][0].idempotencyKey as string;
    expect(idempotencyKey.length).toBeLessThanOrEqual(45);
    expect(idempotencyKey.startsWith("BK-1-")).toBe(true);
    expect(idempotencyKey).not.toBe("BK-1");
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_id: "booking-1",
        amount_cents: 102900,
        payment_method: "paynow",
      }),
    );
  });

  it("nie tworzy płatności, gdy druga rata jest już opłacona", async () => {
    const client = bookingClient({ ...unpaidBooking, second_payment_status: "paid" });

    const result = await startSecondInstallmentPaynowPayment({
      adminClient: { from: client.from } as never,
      baseUrl: "https://app.test",
      accessToken: "token-1",
    });

    expect(result).toEqual({
      ok: false,
      reason: "already_paid",
      bookingPath: "/booking/token-1",
    });
    expect(createPaynowPayment).not.toHaveBeenCalled();
  });
});
