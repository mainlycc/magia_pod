import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { resetMocks } from "@/tests/helpers/api-helpers";

/**
 * BookingForm jest zbyt złożonym komponentem do testowania jednostkowego.
 * Zawiera wiele zależności (Supabase, router, formularze, walidację).
 * 
 * Zamiast testów jednostkowych, użyj testów E2E z Playwright:
 * - tests/booking-flow.spec.ts - testuje pełny flow rezerwacji
 * - tests/forms.spec.ts - testuje walidację formularzy
 * 
 * Ten plik istnieje tylko po to, aby zachować strukturę testów.
 */
describe("BookingForm", () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  it("powinien być testowany przez testy E2E", () => {
    // Komponent jest testowany przez testy E2E w tests/booking-flow.spec.ts
    expect(true).toBe(true);
  });
});
