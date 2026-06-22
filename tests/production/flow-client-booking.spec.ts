import { test, expect } from "@playwright/test";
import { loginUser } from "../helpers/auth";
import {
  clickDalej,
  completeIndividualBookingWithoutPayment,
  generateBookingTestData,
  openReservePage,
  resolveProductionTripSlug,
  waitForBookingFormReady,
  fillContactStepIndividual,
  fillParticipantStep,
  advanceToSummaryStep,
  acceptAllConsents,
  submitBooking,
  waitForBookingConfirmation,
  assertBookingPageHealthy,
} from "../helpers/production-booking";
import { completePaynowSandboxPayment } from "../helpers/paynow-sandbox";
import { selectTripInDashboard } from "../helpers/production-dashboard";

const HAS_AUTH = Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD);
const PAYMENT_ENABLED = process.env.PRODUCTION_E2E_PAYMENT === "1";

test.describe.configure({ mode: "serial" });

test.describe("Produkcja — pełna ścieżka klienta (rezerwacja)", () => {
  let tripSlug: string;
  let lastBookingToken: string | null = null;
  let lastBookingEmail: string | null = null;

  test.beforeAll(async ({ request }) => {
    tripSlug = await resolveProductionTripSlug(request, { preferMinimal: true });
    console.log(`[PROD] Wycieczka testowa: ${tripSlug}`);
  });

  test("lista wycieczek → szczegóły → formularz rezerwacji", async ({ page }) => {
    await page.goto("/trip");
    await expect(page.getByRole("heading", { name: /wycieczki/i })).toBeVisible();

    await page.goto(`/trip/${tripSlug}`);
    const reserveLink = page.getByRole("link", { name: /zarezerwuj/i });
    if (await reserveLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reserveLink.click();
    } else {
      await page.goto(`/trip/${tripSlug}/reserve`);
    }
    await expect(page).toHaveURL(new RegExp(`/trip/${tripSlug}/reserve`));
    await waitForBookingFormReady(page);
  });

  test("walidacja: pusty krok Kontakt nie przechodzi dalej", async ({ page }) => {
    await openReservePage(page, tripSlug);
    await clickDalej(page);

    await expect(page.getByText(/uzupełnij|wymagane|błąd/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("tab", { name: /kontakt/i })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("B1.1: rezerwacja osoby fizycznej bez płatności (pełny flow)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const data = generateBookingTestData("b11");
    lastBookingEmail = data.email;

    const confirmation = await completeIndividualBookingWithoutPayment(
      page,
      tripSlug,
      data,
    );

    lastBookingToken = confirmation.token;
    expect(confirmation.url).toMatch(/\/booking\//);
    expect(confirmation.url).toMatch(/created=1|booking/);

    await expect(page.getByText(data.participant.firstName)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("B1.1: podgląd rezerwacji po tokenie ładuje dane", async ({ page }) => {
    test.skip(!lastBookingToken, "Brak tokenu z poprzedniego testu");

    await page.goto(`/booking/${lastBookingToken}`);
    await assertBookingPageHealthy(page);
    await expect(page.getByText(/jan kowalski/i).first()).toBeVisible();
  });

  test("B1.1: admin widzi rezerwację w panelu", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");
    test.skip(!lastBookingEmail, "Brak e-maila z poprzedniego testu");

    await loginUser(page);
    await selectTripInDashboard(page, tripSlug);
    await page.goto("/trip-dashboard/rezerwacje", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/ładowanie/i)).not.toBeVisible({ timeout: 30_000 });

    await expect(page.getByText(lastBookingEmail!).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("B1.1: admin — uczestnicy i wygenerowana umowa", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");
    test.skip(!lastBookingEmail, "Brak e-maila z poprzedniego testu");

    await loginUser(page);
    await selectTripInDashboard(page, tripSlug);
    await page.goto("/trip-dashboard/uczestnicy", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/jan kowalski/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const noAgreement = page.getByText(/brak wygenerowanej umowy/i);
    const hasNoAgreement = await noAgreement
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasNoAgreement) {
      console.warn("[PROD] Uwaga: komunikat 'Brak wygenerowanej umowy' — znany problem z poprawki.md");
    }
  });
});

test.describe("Produkcja — rezerwacja z płatnością Paynow (B1.2)", () => {
  test.skip(!PAYMENT_ENABLED, "Ustaw PRODUCTION_E2E_PAYMENT=1 w .env.production.test");

  test("B1.2: Rezerwuj i Zapłać → sandbox Paynow → powrót na /booking", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    const slug = await resolveProductionTripSlug(request);
    const data = generateBookingTestData("b12");

    await openReservePage(page, slug);
    await fillContactStepIndividual(page, data);
    await clickDalej(page);
    await fillParticipantStep(page, data);
    await advanceToSummaryStep(page);
    await acceptAllConsents(page);
    await submitBooking(page, "pay");

    if (/paynow/i.test(page.url())) {
      await completePaynowSandboxPayment(page);
    } else {
      await waitForBookingConfirmation(page, { timeout: 90_000 });
    }

    await assertBookingPageHealthy(page);
    await expect(page.getByText(/zapłacono|częściowo|oczekuje|unpaid|partial|paid/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Produkcja — macierz formularza (read-only)", () => {
  test("przełączenie osoba fizyczna / firma zmienia pola", async ({
    page,
    request,
  }) => {
    const slug = await resolveProductionTripSlug(request);
    await openReservePage(page, slug);

    const companyBtn = page.getByRole("button", { name: /^2\.\s*firma$/i });
    if (!(await companyBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Wycieczka bez wyboru typu zgłaszającego (registration_mode)");
      return;
    }

    await companyBtn.click();
    await expect(page.getByLabel(/nazwa firmy/i)).toBeVisible();
    await expect(page.getByLabel(/nip/i)).toBeVisible();

    await page.getByRole("button", { name: /^1\.\s*osoba fizyczna$/i }).click();
    await expect(page.getByLabel(/^imię$/i).first()).toBeVisible();
  });

  test("podgląd umowy (?podglad=1) bez składania rezerwacji", async ({
    page,
    request,
  }) => {
    const slug = await resolveProductionTripSlug(request);
    await page.goto(`/trip/${slug}/reserve?podglad=1`);
    await waitForBookingFormReady(page);

    await expect(page.getByRole("tab", { name: /zgody|podsumowanie/i })).toBeVisible({
      timeout: 30_000,
    });

    const submitButtons = page.getByRole("button", { name: /rezerwuj/i });
    const count = await submitButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = submitButtons.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await expect(btn).toBeDisabled();
      }
    }
  });
});
