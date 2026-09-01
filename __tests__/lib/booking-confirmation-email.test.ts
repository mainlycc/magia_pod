import { describe, it, expect } from "@jest/globals";
import {
  buildBookingConfirmationEmailSubject,
  formatAgreementPdfFilename,
  formatPlnFromCents,
  resolveDepositDeadline,
} from "@/lib/email/booking-confirmation-data";
import {
  generateBookingConfirmationEmail,
  generateBookingConfirmationEmailText,
} from "@/lib/email/templates/booking-confirmation";

describe("booking confirmation email", () => {
  it("formatuje tytuł maila z numerem umowy i nazwą wycieczki", () => {
    expect(
      buildBookingConfirmationEmailSubject({
        agreementNumber: "123456/001",
        tripTitle: "Sycylia",
      }),
    ).toBe("Potwierdzenie rezerwacji 123456/001 | Sycylia");
  });

  it("generuje nazwę pliku umowy bez slasha", () => {
    expect(formatAgreementPdfFilename("123456/001")).toBe("Umowa_123456-001.pdf");
  });

  it("zawiera publiczny numer umowy, nie booking_ref", () => {
    const html = generateBookingConfirmationEmail({
      agreementNumber: "123456/001",
      tripNumber: "123456",
      contactFirstName: "Jan",
      contactLastName: "Kowalski",
      tripTitle: "Sycylia",
      tripLocation: "Włochy",
      tripStartDate: "2026-06-01",
      tripEndDate: "2026-06-10",
      participantsCount: 2,
      tripTotalPricePln: "5 998,00 zł",
      depositDeadline: "01.03.2026",
      showPaymentInstructions: true,
      paymentLink: null,
      attachmentFilenames: ["Umowa_123456-001.pdf", "Program.pdf"],
    });

    expect(html).toContain("123456/001");
    expect(html).toContain("Jan");
    expect(html).toContain("Kowalski");
    expect(html).toContain("5 998,00 zł");
    expect(html).not.toContain("BK-");
  });

  it("generuje wersję tekstową spójną z html", () => {
    const params = {
      agreementNumber: "123456/001",
      tripNumber: "123456",
      contactFirstName: "Anna",
      contactLastName: "Nowak",
      tripTitle: "Grecja",
      tripLocation: null,
      tripStartDate: "2026-07-01",
      tripEndDate: null,
      participantsCount: 1,
      tripTotalPricePln: "2 999,00 zł",
      depositDeadline: "15.04.2026",
      showPaymentInstructions: false,
      attachmentFilenames: [] as string[],
    };

    const text = generateBookingConfirmationEmailText(params);
    expect(text).toContain("Numer umowy: 123456/001");
    expect(text).not.toContain("Płatność");
  });

  it("formatPlnFromCents", () => {
    expect(formatPlnFromCents(599800)).toContain("5");
    expect(formatPlnFromCents(599800)).toContain("zł");
  });

  it("resolveDepositDeadline używa harmonogramu", () => {
    expect(
      resolveDepositDeadline(
        [{ installment_number: 1, due_date: "2026-03-15" }],
        "2026-06-01",
      ),
    ).toMatch(/15\.03\.2026|15\.3\.2026/);
  });
});
