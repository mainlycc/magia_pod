import { describe, it, expect } from "@jest/globals";
import {
  buildAgreementUpdatedEmailSubject,
  formatUpdatedAgreementPdfFilename,
} from "@/lib/email/agreement-updated-data";
import {
  generateAgreementUpdatedEmailHtml,
  generateAgreementUpdatedEmailText,
} from "@/lib/email/templates/agreement-updated";

describe("agreement updated email", () => {
  it("formatuje tytuł z numerem umowy i wycieczką", () => {
    expect(
      buildAgreementUpdatedEmailSubject({
        agreementNumber: "123456/001",
        tripTitle: "Sycylia",
      }),
    ).toBe("Zaktualizowana umowa 123456/001 | Sycylia");
  });

  it("generuje nazwę załącznika z numerem umowy", () => {
    expect(formatUpdatedAgreementPdfFilename("123456/001")).toBe(
      "Zaktualizowana_Umowa_123456-001.pdf",
    );
  });

  it("zawiera powitanie i listę załączników bez booking_ref", () => {
    const params = {
      agreementNumber: "123456/001",
      contactFirstName: "Jan",
      tripTitle: "Sycylia",
      attachmentFilename: "Zaktualizowana_Umowa_123456-001.pdf",
    };

    const html = generateAgreementUpdatedEmailHtml(params);
    expect(html).toContain("Zaktualizowana umowa rezerwacji");
    expect(html).toContain("Jan");
    expect(html).toContain("Zaktualizowana_Umowa_123456-001.pdf");
    expect(html).not.toContain("BK-");

    const text = generateAgreementUpdatedEmailText(params);
    expect(text).toContain("Załączone dokumenty");
    expect(text).toContain("Numer umowy: 123456/001");
  });
});
