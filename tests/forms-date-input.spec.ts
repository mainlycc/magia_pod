import { test, expect } from "@playwright/test";
import { loginUser } from "./helpers/auth";
import { createTestTrip, deleteTestTrip, generateUniqueTestData } from "./helpers/db-helpers";

test.describe("Rezerwacje — wybór daty (pkt 7)", () => {
  let tripId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.afterEach(async () => {
    try {
      if (tripId) await deleteTestTrip(tripId);
    } catch {}
    tripId = null;
  });

  test("datepicker pozwala zmienić miesiąc i wpisać datę ręcznie DD/MM/RRRR", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Dates ${Date.now()}`,
      slug: uniq.tripSlug,
      is_public: true,
    });
    tripId = trip.id;

    // Ten test jest „kontraktowy” pod oczekiwany UX:
    // 1) przełączanie miesiąca bez dropdown listy,
    // 2) możliwość ręcznego wpisu DD/MM/RRRR.
    // Jeśli obecny komponent tego nie wspiera — test ma to wykryć (fail) i blokować regresje po wdrożeniu.

    await page.goto(`/trip/${trip.public_slug ?? trip.slug}/reserve`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Otwórz date picker (najczęściej to przycisk z ikoną kalendarza).
    const dateButton = page.getByRole("button", { name: /wybierz datę|data/i }).first();
    await expect(dateButton).toBeVisible();
    await dateButton.click();

    // Oczekujemy przycisków następny/poprzedni miesiąc (a nie tylko dropdown).
    const next = page.getByRole("button", { name: /następny miesiąc|next month/i });
    const prev = page.getByRole("button", { name: /poprzedni miesiąc|previous month/i });
    await expect(next).toBeVisible();
    await expect(prev).toBeVisible();

    // Oczekujemy ręcznego inputu w formacie DD/MM/RRRR.
    const manual = page.locator('input[placeholder*="DD/MM"]').first();
    await expect(manual).toBeVisible();
    await manual.fill("05/07/2026");

    // Walidacja: pole powinno zaakceptować datę i zamienić na ISO w stanie formularza.
    await manual.blur();
    await expect(manual).toHaveValue(/05\/07\/2026/);
  });
});

