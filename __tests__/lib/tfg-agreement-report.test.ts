import { describe, it, expect, jest } from "@jest/globals";

jest.mock("exceljs", () => ({
  __esModule: true,
  default: class MockWorkbook {
    addWorksheet() {
      return { addRow: jest.fn() };
    }
    xlsx = {
      writeBuffer: jest.fn(async () => new ArrayBuffer(0)),
    };
  },
}));

jest.mock("jspdf", () => ({
  __esModule: true,
  jsPDF: class MockJsPdf {
    setFont() {}
    setFontSize() {}
    text() {}
    output() {
      return new ArrayBuffer(0);
    }
  },
}));

jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/lib/pdf/register-noto-fonts", () => ({
  __esModule: true,
  NOTO_SANS_FAMILY: "NotoSans",
  registerNotoFonts: jest.fn(),
}));

const {
  buildDetailRowFromBooking,
  DETAIL_HEADERS,
  getAgreementConclusionDate,
  isConcludedAgreement,
  isEffectiveDateInRange,
  resolvePeriodBounds,
} = require("@/lib/reports/tfg-agreement-report");

describe("lib/reports/tfg-agreement-report", () => {
  describe("resolvePeriodBounds", () => {
    it("ustawia granice miesiąca w strefie Europe/Warsaw (lato, CEST)", () => {
      const { startIso, endIso } = resolvePeriodBounds("month", { year: 2026, month: 6 });

      expect(startIso).toBe("2026-05-31T22:00:00.000Z");
      expect(endIso).toBe("2026-06-30T21:59:59.999Z");
    });

    it("ustawia granice miesiąca w strefie Europe/Warsaw (zima, CET)", () => {
      const { startIso, endIso } = resolvePeriodBounds("month", { year: 2026, month: 1 });

      expect(startIso).toBe("2025-12-31T23:00:00.000Z");
      expect(endIso).toBe("2026-01-31T22:59:59.999Z");
    });

    it("ustawia granice pojedynczego dnia w strefie Europe/Warsaw", () => {
      const { startIso, endIso } = resolvePeriodBounds("range", {
        dateFrom: "2026-06-16",
        dateTo: "2026-06-16",
      });

      expect(startIso).toBe("2026-06-15T22:00:00.000Z");
      expect(endIso).toBe("2026-06-16T21:59:59.999Z");
    });
  });

  describe("getAgreementConclusionDate", () => {
    it("preferuje signed_at nad generated_at", () => {
      const date = getAgreementConclusionDate({
        signed_at: "2026-06-16T10:00:00.000Z",
        generated_at: "2026-06-15T08:00:00.000Z",
      });

      expect(date).toBe("2026-06-16T10:00:00.000Z");
    });

    it("używa generated_at gdy brak signed_at", () => {
      const date = getAgreementConclusionDate({
        signed_at: null,
        generated_at: "2026-06-15T08:00:00.000Z",
      });

      expect(date).toBe("2026-06-15T08:00:00.000Z");
    });
  });

  describe("isEffectiveDateInRange", () => {
    it("uwzględnia umowę podpisaną dziś mimo wcześniejszego generated_at", () => {
      const { startIso, endIso } = resolvePeriodBounds("range", {
        dateFrom: "2026-06-16",
        dateTo: "2026-06-16",
      });

      const conclusion = getAgreementConclusionDate({
        signed_at: "2026-06-16T08:00:00.000Z",
        generated_at: "2026-06-15T08:00:00.000Z",
      });

      expect(isEffectiveDateInRange(conclusion, startIso, endIso)).toBe(true);
    });

    it("pomija generated_at spoza zakresu gdy brak signed_at", () => {
      const { startIso, endIso } = resolvePeriodBounds("range", {
        dateFrom: "2026-06-16",
        dateTo: "2026-06-16",
      });

      const conclusion = getAgreementConclusionDate({
        signed_at: null,
        generated_at: "2026-06-15T08:00:00.000Z",
      });

      expect(isEffectiveDateInRange(conclusion, startIso, endIso)).toBe(false);
    });
  });

  describe("isConcludedAgreement", () => {
    it("akceptuje umowę ze statusem signed", () => {
      expect(
        isConcludedAgreement(
          { status: "signed" },
          { status: "confirmed", payment_status: "paid" },
        ),
      ).toBe(true);
    });

    it("pomija nieopłaconą umowę wygenerowaną bez podpisu", () => {
      expect(
        isConcludedAgreement(
          { status: "generated" },
          { status: "confirmed", payment_status: "unpaid" },
        ),
      ).toBe(false);
    });

    it("akceptuje legacy: opłacona rezerwacja bez statusu signed", () => {
      expect(
        isConcludedAgreement(
          { status: "generated" },
          { status: "confirmed", payment_status: "paid" },
        ),
      ).toBe(true);
    });

    it("pomija anulowaną rezerwację", () => {
      expect(
        isConcludedAgreement(
          { status: "signed" },
          { status: "cancelled", payment_status: "paid" },
        ),
      ).toBe(false);
    });
  });

  describe("buildDetailRowFromBooking", () => {
    it("buduje wiersz TFG z nowymi polami lokalizacji i wartościami domyślnymi", () => {
      expect(DETAIL_HEADERS).toEqual([
        "Numer umowy",
        "Przedmiot umowy",
        "Data zawarcia umowy",
        "Termin rozpoczęcia imprezy",
        "Termin zakończenia imprezy",
        "Liczba podróżnych",
        "Zakres Terytorialny 1",
        "Kraj Realizacji Umowy 1",
        "Miejscowość Realizacji Umowy 1",
        "Zakres Terytorialny 2",
        "Kraj 2",
        "Miejscowość 2",
        "Rodzaj środka transportu",
        "Kody lotnisk",
        "Łączna cena usług",
        "WalutaUslug1",
        "SposobPrzyjmowaniaWplat",
        "Data anulacji",
      ]);

      const row = buildDetailRowFromBooking(
        {
          id: "booking-1",
          status: "confirmed",
          payment_status: "paid",
          booking_ref: "BOOK-1",
          cancelled_at: "2026-06-12T08:00:00.000Z",
          trips: {
            title: "Nieuzywane",
            start_date: "2026-07-10",
            end_date: "2026-07-15",
            location: "Nieuzywane",
            category: "ABC",
            price_cents: 123456,
            reservation_number: "12",
            transport_mode: "LOTNCZART",
            airport_codes: "WAW,KRK",
            territorial_scope: "EUR",
            country: "Hiszpania",
            locality: "Barcelona",
            territorial_scope_2: "PLISAS",
            country_2: "Polska",
            locality_2: "Warszawa",
          },
          participants: [{ id: "p1" }, { id: "p2" }],
        },
        {
          agreement_seq: 7,
          conclusion_date: "2026-06-10T10:00:00.000Z",
        },
        { cancellationDate: "2026-06-12T08:00:00.000Z" },
      );

      expect(row).toEqual([
        "#000012/007",
        "IT",
        "10.06.2026",
        "10.07.2026",
        "15.07.2026",
        "2",
        "EUR",
        "Hiszpania",
        "Barcelona",
        "PLISAS",
        "Polska",
        "Warszawa",
        "LOTNCZART",
        "WAW,KRK",
        "2469,12",
        "PLN",
        "WPLATAPRZED",
        "12.06.2026",
      ]);
    });
  });
});
