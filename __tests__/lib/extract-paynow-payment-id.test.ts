import {
  extractPaynowPaymentIdFromNotes,
  isPaynowHistoryEntry,
  withPaynowStatusConfirmed,
} from "@/lib/paynow/extract-payment-id";
import { countsTowardPaidAmount } from "@/lib/bookings/payment-history-counts";

describe("withPaynowStatusConfirmed", () => {
  it("podmienia PENDING z init na CONFIRMED i zachowuje resztę notatki", () => {
    const notes = "Paynow payment P8AT-IXJ-A8I-TB0 - status: PENDING (initialized) - zaliczka";
    const next = withPaynowStatusConfirmed(notes);
    expect(next).toBe("Paynow payment P8AT-IXJ-A8I-TB0 - status: CONFIRMED (initialized) - zaliczka");
    expect(countsTowardPaidAmount({ payment_method: "paynow", notes: next, amount_cents: 95000 })).toBe(true);
  });

  it("nie zmienia już potwierdzonej notatki", () => {
    const notes = "Paynow payment abc - status: CONFIRMED";
    expect(withPaynowStatusConfirmed(notes)).toBe(notes);
  });

  it("dopisuje status, gdy go brak", () => {
    expect(withPaynowStatusConfirmed("Paynow payment abc")).toBe("Paynow payment abc - status: CONFIRMED");
  });
});

describe("extractPaynowPaymentIdFromNotes", () => {
  it("wyciąga id z typowej notatki", () => {
    expect(
      extractPaynowPaymentIdFromNotes(
        "Paynow payment abc-123-def - status: CONFIRMED - zaliczka 30%",
      ),
    ).toBe("abc-123-def");
  });

  it("wyciąga UUID", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(extractPaynowPaymentIdFromNotes(`Paynow payment ${id} - status: PENDING`)).toBe(id);
  });

  it("zwraca null dla pustych notatek", () => {
    expect(extractPaynowPaymentIdFromNotes(null)).toBeNull();
    expect(extractPaynowPaymentIdFromNotes("")).toBeNull();
    expect(extractPaynowPaymentIdFromNotes("Wpłata ręczna")).toBeNull();
  });
});

describe("isPaynowHistoryEntry", () => {
  it("rozpoznaje po payment_method", () => {
    expect(isPaynowHistoryEntry({ payment_method: "paynow", notes: null })).toBe(true);
  });

  it("rozpoznaje po notes", () => {
    expect(
      isPaynowHistoryEntry({
        payment_method: null,
        notes: "Paynow payment xyz - status: PENDING",
      }),
    ).toBe(true);
  });

  it("odrzuca ręczne", () => {
    expect(isPaynowHistoryEntry({ payment_method: "manual", notes: "zaliczka" })).toBe(false);
  });
});
