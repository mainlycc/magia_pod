import { describe, it, expect } from "@jest/globals";
import {
  buildPaymentReminderAmounts,
  buildPaymentReminderEmailSubject,
  buildPaymentReminderPaymentLink,
  toPaymentReminderEmailParams,
} from "@/lib/email/payment-reminder-data";
import {
  generatePaymentReminderEmail,
  generatePaymentReminderEmailText,
} from "@/lib/email/templates/payment-reminder";

describe("payment reminder email", () => {
  it("formatuje tytuł z numerem umowy i wycieczką", () => {
    expect(
      buildPaymentReminderEmailSubject({
        agreementNumber: "123456/001",
        tripTitle: "Sycylia",
      }),
    ).toBe("Przypomnienie o płatności 123456/001 | Sycylia");
  });

  it("preferuje link z access_token zamiast booking_ref", () => {
    expect(buildPaymentReminderPaymentLink("https://app.test", "token-abc", "BK-123")).toBe(
      "https://app.test/booking/token-abc?payment=second",
    );
  });

  it("liczy kwoty całkowitą, opłaconą i pozostałą", () => {
    const amounts = buildPaymentReminderAmounts({
      firstPaymentAmountCents: 300000,
      secondPaymentAmountCents: 700000,
      paidAmountCents: 300000,
    });
    expect(amounts.totalCents).toBe(1000000);
    expect(amounts.paidCents).toBe(300000);
    expect(amounts.remainingCents).toBe(700000);
  });

  it("zawiera szczegóły rezerwacji i link płatności", () => {
    const params = toPaymentReminderEmailParams({
      agreementNumber: "123456/001",
      contactFirstName: "Jan",
      tripTitle: "Sycylia",
      tripLocation: "Włochy",
      tripStartDate: "2026-06-01",
      tripEndDate: "2026-06-10",
      totalCents: 1000000,
      paidCents: 300000,
      remainingCents: 700000,
      paymentLink: "https://app.test/booking/token?payment=second",
    });

    const html = generatePaymentReminderEmail(params);
    expect(html).toContain("123456/001");
    expect(html).toContain("Jan");
    expect(html).toContain("Pozostało do zapłaty");
    expect(html).not.toContain("BK-");

    const text = generatePaymentReminderEmailText(params);
    expect(text).toContain("Dotychczas opłacono");
    expect(text).toContain("7000,00 zł");
  });
});
