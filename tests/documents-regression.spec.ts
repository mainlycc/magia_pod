import { test, expect, type Page } from "@playwright/test";
import { loginUser } from "./helpers/auth";
import {
  cleanupUploadedFiles,
  createTestAgreementPdf,
  createTestBooking,
  createTestInvoiceForBooking,
  createTestParticipants,
  createTestTrip,
  deleteTestBooking,
  deleteTestTrip,
  generateUniqueTestData,
} from "./helpers/db-helpers";

async function selectTrip(page: Page, tripTitle: string) {
  await page.goto("/trip-dashboard", { waitUntil: "domcontentloaded", timeout: 15000 });
  const combo = page.getByRole("combobox").first();
  const select = page.locator("select").first();

  if (await combo.isVisible().catch(() => false)) {
    await combo.click();
    await page.getByText(tripTitle).click({ timeout: 5000 });
  } else if (await select.isVisible().catch(() => false)) {
    await select.selectOption({ label: tripTitle });
  }
  await page.waitForTimeout(800);
}

test.describe("Dokumenty po zawarciu umowy (pkt 9)", () => {
  const created: {
    tripId?: string;
    bookingId?: string;
    uploadedFiles: Array<{ bucket: "agreements" | "documents"; path: string }>;
  } = { uploadedFiles: [] };

  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.afterEach(async () => {
    try {
      if (created.bookingId) await deleteTestBooking(created.bookingId);
    } catch {}
    try {
      if (created.tripId) await deleteTestTrip(created.tripId);
    } catch {}
    try {
      await cleanupUploadedFiles(created.uploadedFiles);
    } catch {}

    created.tripId = undefined;
    created.bookingId = undefined;
    created.uploadedFiles = [];
  });

  test("admin widzi wygenerowaną umowę i fakturę (brak komunikatów 'Brak wygenerowanej ...')", async ({
    page,
  }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Docs ${Date.now()}`,
      slug: uniq.tripSlug,
      is_public: true,
      reservation_number: `DOC-${Date.now()}`,
    });
    created.tripId = trip.id;

    const booking = await createTestBooking(trip.id, {
      booking_ref: uniq.bookingRef,
      contact_email: uniq.email,
      status: "confirmed",
      payment_status: "paid",
    });
    created.bookingId = booking.id;

    await createTestParticipants(booking.id, [{ first_name: "Jan", last_name: "Klient" }]);

    // Seed: umowa z PDF w storage + faktura w DB
    const { file } = await createTestAgreementPdf({ bookingId: booking.id, pdfLabel: "AGREEMENT TEST" });
    created.uploadedFiles.push(file);
    await createTestInvoiceForBooking({ bookingId: booking.id, amount_cents: 12345 });

    await selectTrip(page, trip.title);

    await page.goto(`/trip-dashboard/rezerwacje/${booking.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Umowa: powinna być widoczna jako iframe (a nie tekst "Brak wygenerowanej umowy...")
    await expect(page.getByText(/Brak wygenerowanej umowy/i)).toHaveCount(0);
    await expect(page.locator("iframe")).toBeVisible();

    // Faktura: powinna istnieć i nie wyświetlać stanu "nie wygenerowana" (to jest najbardziej regresyjne)
    await expect(page.getByText(/Faktura nie została jeszcze wygenerowana/i)).toHaveCount(0);
    await expect(page.getByText(/FV\/\d{4}\/\d{3}/)).toBeVisible();
  });
});

