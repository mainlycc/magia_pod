import { describe, it, expect } from "@jest/globals";
import {
  getAgreementConclusionDate,
  isConcludedAgreement,
  isEffectiveDateInRange,
  resolvePeriodBounds,
} from "@/lib/reports/tfg-agreement-report-dates";

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
});
