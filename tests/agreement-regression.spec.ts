import { test, expect, type Page } from "@playwright/test";
import { loginUser } from "./helpers/auth";
import {
  buildSyncedInsuranceServiceId,
  cleanupUploadedFiles,
  createTestBooking,
  createTestInsuranceVariant,
  createTestParticipants,
  createTestTrip,
  createTestTripInsuranceVariant,
  createTripInsuranceTermsDocument,
  deleteTestBooking,
  deleteTestInsuranceVariant,
  deleteTestTrip,
  generateUniqueTestData,
  setParticipantSelectedServices,
} from "./helpers/db-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

async function selectTripByTitle(page: Page, tripTitle: string) {
  await page.goto("/trip-dashboard", { waitUntil: "domcontentloaded", timeout: 15000 });

  const combo = page.getByRole("combobox").first();
  const select = page.locator("select").first();

  if (await combo.isVisible().catch(() => false)) {
    await combo.click();
    await page.getByText(tripTitle).click({ timeout: 5000 });
  } else if (await select.isVisible().catch(() => false)) {
    await select.selectOption({ label: tripTitle });
  }

  // Trip-context zwykle dociąga dane asynchronicznie
  await page.waitForTimeout(800);
}

test.describe("Umowa — testy regresji (pkt 3,4,5,5a,8,11)", () => {
  const created: {
    tripId?: string;
    bookingId?: string;
    insuranceVariantIds: string[];
    uploadedFiles: Array<{ bucket: "agreements" | "documents"; path: string }>;
  } = { insuranceVariantIds: [], uploadedFiles: [] };

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
    for (const id of created.insuranceVariantIds) {
      try {
        await deleteTestInsuranceVariant(id);
      } catch {}
    }
    try {
      await cleanupUploadedFiles(created.uploadedFiles);
    } catch {}

    created.tripId = undefined;
    created.bookingId = undefined;
    created.insuranceVariantIds = [];
    created.uploadedFiles = [];
  });

  test("pkt 5: Dane do umowy zapisują się + placeholdery podstawiają wartości", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Umowa Fields ${Date.now()}`,
      slug: uniq.tripSlug,
      registration_mode: "individual",
      is_public: true,
    });
    created.tripId = trip.id;

    await selectTripByTitle(page, trip.title);
    await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded", timeout: 15000 });

    const room = `Pokój 2-osobowy ${Date.now()}`;
    const meals = `Śniadania ${Date.now()}`;
    const transfer = `Transfer test ${Date.now()}`;

    await page.getByLabel(/rodzaj, typ pokoju/i).fill(room);
    await page.getByLabel(/ilość, rodzaj posiłków/i).fill(meals);
    await page.getByLabel(/transfery/i).fill(transfer);

    await page.getByRole("button", { name: /zapisz dane umowy/i }).click();
    await page.waitForTimeout(800);

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByLabel(/rodzaj, typ pokoju/i)).toHaveValue(room);
    await expect(page.getByLabel(/ilość, rodzaj posiłków/i)).toHaveValue(meals);
    await expect(page.getByLabel(/transfery/i)).toHaveValue(transfer);

    // Podgląd powinien zawierać podstawione wartości (najczęściej w tabeli umowy)
    await expect(page.getByText(room)).toBeVisible();
    await expect(page.getByText(meals)).toBeVisible();
    await expect(page.getByText(transfer)).toBeVisible();
  });

  test("pkt 3+4: zapis szablonu działa, a generowany PDF używa nowej wersji", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Umowa Template ${Date.now()}`,
      slug: uniq.tripSlug,
      registration_mode: "individual",
      is_public: true,
      reservation_number: `R-${Date.now()}`,
    });
    created.tripId = trip.id;

    const booking = await createTestBooking(trip.id, {
      booking_ref: uniq.bookingRef,
      contact_email: uniq.email,
      payment_status: "paid",
    });
    created.bookingId = booking.id;

    const [p1] = await createTestParticipants(booking.id, [
      { first_name: "Ala", last_name: "Testowa" },
    ]);
    await setParticipantSelectedServices(p1.id, {});

    await selectTripByTitle(page, trip.title);
    await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded", timeout: 15000 });

    const marker = `MARKER-${Date.now()}`;

    // Zmień pierwszą wartość w tabeli szablonu (Input z placeholderem "Wartość lub {{placeholder}}...")
    const valueInput = page
      .locator('input[placeholder="Wartość lub {{placeholder}}..."]')
      .first();
    await expect(valueInput).toBeVisible({ timeout: 10000 });
    await valueInput.fill(marker);

    await page.getByRole("button", { name: /^zapisz$/i }).click();
    await page.waitForTimeout(1200);

    // Refresh: zmiana nie może zniknąć (problem pkt 3)
    await page.reload({ waitUntil: "domcontentloaded" });
    const valueInputAfter = page
      .locator('input[placeholder="Wartość lub {{placeholder}}..."]')
      .first();
    await expect(valueInputAfter).toHaveValue(marker);

    // Wygeneruj finalną umowę dla rezerwacji (pkt 4)
    const gen = await page.evaluate(async (bookingId) => {
      const res = await fetch(`/api/bookings/${bookingId}/agreement`, { method: "POST" });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    }, booking.id);
    expect(gen.ok).toBeTruthy();

    // Pobierz PDF z bucketa i sprawdź, że marker jest zaszyty w treści (najczęściej jako plain text w PDF)
    const admin = createAdminClient();
    const { data: agr, error: agrErr } = await admin
      .from("agreements")
      .select("pdf_url")
      .eq("booking_id", booking.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(agrErr).toBeNull();
    expect(agr?.pdf_url).toBeTruthy();

    const pdfPath = String(agr!.pdf_url);
    const { data: blob, error: dlErr } = await admin.storage.from("agreements").download(pdfPath);
    expect(dlErr).toBeNull();
    const buf = Buffer.from(await blob!.arrayBuffer());

    // Heurystyka: wiele PDF generatorów zapisuje część tekstów jawnie.
    // Jeśli PDF jest skompresowany, ten test może wymagać dopracowania (np. PDF text extraction).
    const haystack = buf.toString("latin1");
    expect(haystack.includes(marker)).toBeTruthy();
  });

  test("pkt 5a + 11: insurance_scope i selected_services są wypełnione, a usługi grupują się per uczestnik", async ({
    page,
  }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Services ${Date.now()}`,
      slug: uniq.tripSlug,
      registration_mode: "individual",
      is_public: true,
      reservation_number: `RSV-${Date.now()}`,
      form_diets: [{ id: "diet-veg", title: "Dieta wegetariańska" }],
      form_additional_attractions: [{ id: "attr-boat", title: "Rejs statkiem" }],
      // form_extra_insurances wypełnimy przez sync z trip_insurance_variants
    });
    created.tripId = trip.id;

    // OWU (insurance_terms) jako dokument — wspólne miejsce konfiguracji
    const { file } = await createTripInsuranceTermsDocument({ tripId: trip.id });
    created.uploadedFiles.push(file);

    // Konfiguracja typ 2 i 3 w module ubezpieczeń
    const v2 = await createTestInsuranceVariant({ type: 2, name: `Typ2 ${Date.now()}` });
    const v3 = await createTestInsuranceVariant({ type: 3, name: `Typ3 ${Date.now()}` });
    created.insuranceVariantIds.push(v2.id, v3.id);

    const tiv2 = await createTestTripInsuranceVariant({
      tripId: trip.id,
      variantId: v2.id,
      price_grosz: 1234,
    });
    const tiv3 = await createTestTripInsuranceVariant({
      tripId: trip.id,
      variantId: v3.id,
      price_grosz: 2345,
    });

    const booking = await createTestBooking(trip.id, {
      booking_ref: uniq.bookingRef,
      contact_email: uniq.email,
      payment_status: "paid",
    });
    created.bookingId = booking.id;

    const participants = await createTestParticipants(booking.id, [
      { first_name: "U1", last_name: "Test", selected_services: {} },
      { first_name: "U2", last_name: "Test", selected_services: {} },
    ]);

    // Podstaw selected_services: diety/atrakcje + ubezpieczenia typ2/typ3 per uczestnik
    await setParticipantSelectedServices(participants[0].id, {
      diets: [{ service_id: "diet-veg", price_cents: 0 }],
      insurances: [{ service_id: buildSyncedInsuranceServiceId(tiv2.id), price_cents: 1234 }],
      attractions: [{ service_id: "attr-boat", price_cents: 5000, include_in_contract: true }],
    });
    await setParticipantSelectedServices(participants[1].id, {
      diets: [],
      insurances: [{ service_id: buildSyncedInsuranceServiceId(tiv3.id), price_cents: 2345 }],
      attractions: [{ service_id: "attr-boat", price_cents: 5000, include_in_contract: true }],
    });

    await selectTripByTitle(page, trip.title);

    // Wejście na zakładkę ubezpieczenia robi best-effort sync form_extra_insurances i participant_insurances
    await page.goto("/trip-dashboard/ubezpieczenia", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);

    // Sprawdź, że zakładka nie pokazuje błędnego komunikatu o braku uczestników (pkt 2 pośrednio)
    await expect(page.getByText(/brak uczestników z aktywnymi rezerwacjami/i)).toHaveCount(0);

    // Podgląd umowy powinien zawierać zakres ubezpieczenia i usługi pogrupowane per uczestnik
    await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded", timeout: 15000 });

    await expect(page.getByText(/ubezpieczenie podstawowe/i)).toBeVisible();
    await expect(page.getByText(/dodatkowe ubezpieczenia/i)).toBeVisible();

    await expect(page.getByText(/Uczestnik 1/i)).toBeVisible();
    await expect(page.getByText(/Uczestnik 2/i)).toBeVisible();
    await expect(page.getByText(/Dieta wegetariańska/i)).toBeVisible();
    await expect(page.getByText(/Rejs statkiem/i)).toBeVisible();
  });
});

