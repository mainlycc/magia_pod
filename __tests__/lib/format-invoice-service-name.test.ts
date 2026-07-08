import {
  buildInvoiceServiceName,
  formatInvoiceTripDateRange,
  INVOICE_VAT_MARGIN_NOTE,
} from "@/lib/invoices/format-invoice-service-name";

describe("INVOICE_VAT_MARGIN_NOTE", () => {
  it("ma oczekiwaną treść uwag na fakturze zaliczkowej", () => {
    expect(INVOICE_VAT_MARGIN_NOTE).toBe("Faktura VAT-marża dla biur podróży");
  });
});

describe("formatInvoiceTripDateRange", () => {
  it("formatuje ten sam miesiąc jako DD-DD.MM.YYYY", () => {
    expect(formatInvoiceTripDateRange("2026-12-03", "2026-12-04")).toBe("03-04.12.2026");
  });

  it("formatuje różne miesiące w tym samym roku", () => {
    expect(formatInvoiceTripDateRange("2026-11-30", "2026-12-03")).toBe("30.11-03.12.2026");
  });

  it("formatuje różne lata", () => {
    expect(formatInvoiceTripDateRange("2026-12-30", "2027-01-02")).toBe("30.12.2026-02.01.2027");
  });

  it("zwraca pojedynczą datę gdy brak end_date", () => {
    expect(formatInvoiceTripDateRange("2026-12-03", null)).toBe("03.12.2026");
  });

  it("zwraca pojedynczą datę gdy start i end są takie same", () => {
    expect(formatInvoiceTripDateRange("2026-12-03", "2026-12-03")).toBe("03.12.2026");
  });

  it("zwraca pusty string gdy brak dat", () => {
    expect(formatInvoiceTripDateRange(null, null)).toBe("");
  });
});

describe("buildInvoiceServiceName", () => {
  it("składa pełną nazwę usługi z datą i numerem umowy", () => {
    expect(
      buildInvoiceServiceName({
        title: "Praga - złoty skarbiec Czech",
        startDate: "2026-12-03",
        endDate: "2026-12-04",
        reservationNumber: "130426",
        agreementSeq: 1,
      }),
    ).toBe("Praga - złoty skarbiec Czech, 03-04.12.2026, #130426/001");
  });

  it("pomija numer gdy brak agreement_seq", () => {
    expect(
      buildInvoiceServiceName({
        title: "Praga - złoty skarbiec Czech",
        startDate: "2026-12-03",
        endDate: "2026-12-04",
        reservationNumber: "130426",
        agreementSeq: null,
      }),
    ).toBe("Praga - złoty skarbiec Czech, 03-04.12.2026");
  });

  it("zwraca sam tytuł gdy brak dat i numeru", () => {
    expect(
      buildInvoiceServiceName({
        title: "Praga - złoty skarbiec Czech",
      }),
    ).toBe("Praga - złoty skarbiec Czech");
  });
});
