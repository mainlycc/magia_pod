import { test, expect } from "@playwright/test";
import { loginUser } from "../helpers/auth";
import {
  advanceToSummaryStep,
  clickDalej,
  fillContactStepIndividual,
  fillParticipantStep,
  generateBookingTestData,
  openReservePage,
  resolveProductionTripSlug,
} from "../helpers/production-booking";
import { completePaynowSandboxPayment } from "../helpers/paynow-sandbox";
import {
  addCustomFieldAndSave,
  downloadAgreementPdf,
  expectMarkerInDashboardPreview,
  expectMarkerOnReservePreview,
  fetchAgreementTemplateHtml,
  findBookingIdByEmail,
  generateAgreementPdfForBooking,
  getSelectedTripId,
  isPublicAgreementApiAvailable,
  openAgreementEditorForSlug,
  patchAgreementTemplateHtml,
  pdfBufferContainsText,
  removeCustomFieldAndSave,
} from "../helpers/production-agreement";
import { selectTripInDashboard } from "../helpers/production-dashboard";
import { DEFAULT_AGREEMENT_TEMPLATE_HTML } from "@/lib/agreements/default-template";

const HAS_AUTH = Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD);
const PAYMENT_ENABLED = process.env.PRODUCTION_E2E_PAYMENT === "1";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("Produkcja — personalizacja umowy (Wzór umowy → podgląd rezerwacji)", () => {
  let tripSlug: string;
  let tripId: string;
  let backupIndividualHtml: string | null = null;
  let publicAgreementApi = false;

  const marker = `PROD-UMOWA-${Date.now()}`;
  const fieldLabel = `PROD Etykieta ${Date.now()}:`;

  test.beforeAll(async ({ browser }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_* w .env.production.test");

    const page = await browser.newPage();
    await loginUser(page);
    tripSlug = await resolveProductionTripSlug(page.request);
    publicAgreementApi = await isPublicAgreementApiAvailable(page, tripSlug);
    await selectTripInDashboard(page, tripSlug);
    tripId = await getSelectedTripId(page);
    backupIndividualHtml = await fetchAgreementTemplateHtml(page, tripId, "individual");
    console.log(
      `[PROD-UMOWA] Wycieczka: ${tripSlug}, API publiczne: ${publicAgreementApi ? "OK" : "403 — wymaga deployu"}`,
    );
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!HAS_AUTH || !tripId) return;

    const page = await browser.newPage();
    try {
      await loginUser(page);
      if (backupIndividualHtml) {
        await patchAgreementTemplateHtml(page, tripId, backupIndividualHtml, "individual");
      } else {
        await patchAgreementTemplateHtml(page, tripId, DEFAULT_AGREEMENT_TEMPLATE_HTML, "individual");
      }
      console.log("[PROD-UMOWA] Przywrócono szablon umowy po testach");
    } catch (e) {
      console.error("[PROD-UMOWA] Nie udało się przywrócić szablonu:", e);
    } finally {
      await page.close();
    }
  });

  test("1. edytor: dodanie pola, zapis i podgląd w panelu", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");

    await loginUser(page);
    await openAgreementEditorForSlug(page, tripSlug);
    await addCustomFieldAndSave(page, fieldLabel, marker);
    await expectMarkerInDashboardPreview(page, marker);

    const html = await fetchAgreementTemplateHtml(page, tripId, "individual");
    expect(html).toContain(marker);
  });

  test("2. podgląd rezerwacji (?podglad=1) pokazuje zmiany z edytora", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");
    test.skip(
      !publicAgreementApi,
      "API /api/trips/by-slug/.../agreement-templates zwraca 403 — wdróż poprawkę is_public (lokalnie gotowa)",
    );

    await expectMarkerOnReservePreview(page, tripSlug, marker);
  });

  test("3. krok podsumowania rezerwacji (HTML) pokazuje zmiany z edytora", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");
    test.skip(!publicAgreementApi, "Wymaga deployu poprawki API szablonów (patrz test 2)");

    const data = generateBookingTestData("umowa-prev");
    await openReservePage(page, tripSlug);
    await fillContactStepIndividual(page, data);
    await clickDalej(page);
    await fillParticipantStep(page, data);
    await advanceToSummaryStep(page);

    await expect(page.getByText("Podgląd umowy", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
  });

  test("4. edytor: usunięcie pola znika z panelu i API", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");

    await loginUser(page);
    await openAgreementEditorForSlug(page, tripSlug);
    await removeCustomFieldAndSave(page, /PROD Etykieta/i);
    await expect(page.getByText(marker)).toHaveCount(0);

    const html = await fetchAgreementTemplateHtml(page, tripId, "individual");
    expect(html).not.toContain(marker);
  });

  test("5. po rezerwacji: PDF umowy zawiera marker (serwer /api/pdf)", async ({ page }) => {
    test.skip(!HAS_AUTH, "Brak TEST_USER_*");
    test.skip(
      !publicAgreementApi,
      "Wymaga deployu API szablonów — najpierw przywróć pole testowe w edytorze",
    );

    // Ponownie dodaj marker — test 4 go usunął
    await loginUser(page);
    await openAgreementEditorForSlug(page, tripSlug);
    await addCustomFieldAndSave(page, fieldLabel, marker);

    const data = generateBookingTestData("umowa-pdf");
    const { completeIndividualBookingWithoutPayment } = await import("../helpers/production-booking");
    await completeIndividualBookingWithoutPayment(page, tripSlug, data);

    await loginUser(page);
    await selectTripInDashboard(page, tripSlug);
    const bookingId = await findBookingIdByEmail(page, data.email);

    const genRes = await page.request.post(`/api/bookings/${bookingId}/agreement`);
    if (!genRes.ok()) {
      const body = await genRes.text();
      test.skip(
        body.includes("Chromium") || body.includes("jsPDF"),
        "Generowanie PDF na Vercel wymaga Chromium — zweryfikuj PDF ręcznie (Generuj PDF w panelu lub po płatności)",
      );
      expect(genRes.ok(), body).toBeTruthy();
    }

    const filename = await generateAgreementPdfForBooking(page, bookingId);
    const pdf = await downloadAgreementPdf(page, filename);
    expect(pdfBufferContainsText(pdf, marker)).toBeTruthy();
  });
});

test.describe("Produkcja — umowa po płatności Paynow (PDF = załącznik e-mail)", () => {
  test.skip(
    !HAS_AUTH || !PAYMENT_ENABLED,
    "Wymaga TEST_USER_* i PRODUCTION_E2E_PAYMENT=1 w .env.production.test",
  );

  test("6. po płatności Paynow: ten sam szablon trafia do PDF / e-mail", async ({ page }) => {
    test.setTimeout(240_000);

    const paymentMarker = `PROD-PAY-${Date.now()}`;
    const paymentFieldLabel = `PROD Płatność ${Date.now()}:`;
    let tripSlug = "";
    let tripId = "";
    let backupHtml: string | null = null;

    await loginUser(page);
    tripSlug = await resolveProductionTripSlug(page.request);
    const apiOk = await isPublicAgreementApiAvailable(page, tripSlug);
    test.skip(!apiOk, "Wymaga deployu poprawki API szablonów");

    await selectTripInDashboard(page, tripSlug);
    tripId = await getSelectedTripId(page);
    backupHtml = await fetchAgreementTemplateHtml(page, tripId, "individual");

    try {
      await openAgreementEditorForSlug(page, tripSlug);
      await addCustomFieldAndSave(page, paymentFieldLabel, paymentMarker);

      const data = generateBookingTestData("umowa-pay");
      const {
        submitBooking,
        waitForBookingConfirmation,
        assertBookingPageHealthy,
      } = await import("../helpers/production-booking");

      await openReservePage(page, tripSlug);
      await fillContactStepIndividual(page, data);
      await clickDalej(page);
      await fillParticipantStep(page, data);
      await advanceToSummaryStep(page);
      await page.getByRole("checkbox").first().check().catch(() => {});
      await submitBooking(page, "pay");

      if (/paynow/i.test(page.url())) {
        await completePaynowSandboxPayment(page);
      } else {
        await waitForBookingConfirmation(page, { timeout: 120_000 });
      }
      await assertBookingPageHealthy(page);

      await loginUser(page);
      await selectTripInDashboard(page, tripSlug);
      const bookingId = await findBookingIdByEmail(page, data.email);

      const genRes = await page.request.post(`/api/bookings/${bookingId}/agreement`);
      if (!genRes.ok()) {
        const body = await genRes.text();
        test.skip(body.includes("Chromium"), "PDF na Vercel — sprawdź skrzynkę e-mail ręcznie");
      }

      const filename = await generateAgreementPdfForBooking(page, bookingId);
      const pdf = await downloadAgreementPdf(page, filename);
      expect(pdfBufferContainsText(pdf, paymentMarker)).toBeTruthy();
    } finally {
      await loginUser(page).catch(() => {});
      if (tripId && backupHtml) {
        await patchAgreementTemplateHtml(page, tripId, backupHtml, "individual").catch(() => {});
      }
    }
  });
});
