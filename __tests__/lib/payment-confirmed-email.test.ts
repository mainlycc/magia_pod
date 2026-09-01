import { describe, it, expect } from "@jest/globals";
import {
  buildPaymentConfirmedEmailSubject,
  INVOICE_EMAIL_ATTACHMENT_FILENAME,
} from "@/lib/email/payment-confirmation-data";
import {
  buildPaymentConfirmedEmailHtml,
  buildPaymentConfirmedEmailText,
} from "@/lib/email/templates/payment-confirmed";

describe("payment confirmed email", () => {
  it("formatuje tytuł z numerem umowy i wycieczką", () => {
    expect(
      buildPaymentConfirmedEmailSubject({
        agreementNumber: "123456/001",
        tripTitle: "Sycylia",
      }),
    ).toBe("Potwierdzenie płatności / Faktura 123456/001 | Sycylia");
  });

  it("zawiera powitanie, potwierdzenie wpłaty i fakturę w załączniku", () => {
    const html = buildPaymentConfirmedEmailHtml({
      agreementNumber: "123456/001",
      contactFirstName: "Jan",
      tripTitle: "Sycylia",
      attachmentFilenames: [INVOICE_EMAIL_ATTACHMENT_FILENAME],
    });

    expect(html).toContain("Potwierdzenie otrzymania płatności");
    expect(html).toContain("Jan");
    expect(html).toContain("Magii Podróżowania");
    expect(html).toContain("wygenerowaną fakturę");
    expect(html).toContain("Faktura.pdf");
  });

  it("generuje wersję tekstową", () => {
    const text = buildPaymentConfirmedEmailText({
      agreementNumber: "123456/001",
      contactFirstName: "Anna",
      tripTitle: "Grecja",
      attachmentFilenames: ["Faktura.pdf"],
    });

    expect(text).toContain("Numer umowy: 123456/001");
    expect(text).toContain("Faktura.pdf");
  });
});
