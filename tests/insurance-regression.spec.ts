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

test.describe("Ubezpieczenia — testy regresji (pkt 1–2)", () => {
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

  test("pkt 1: OWU (insurance_terms) można zdefiniować per wycieczka i jest widoczne w /api/documents/trip", async ({
    page,
  }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip OWU ${Date.now()}`,
      slug: uniq.tripSlug,
      is_public: true,
    });
    created.tripId = trip.id;

    const { file } = await createTripInsuranceTermsDocument({ tripId: trip.id });
    created.uploadedFiles.push(file);

    await selectTrip(page, trip.title);

    const docs = await page.evaluate(async (tripId) => {
      const res = await fetch(`/api/documents/trip/${tripId}`, { method: "GET" });
      const json = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, json };
    }, trip.id);

    expect(docs.ok).toBeTruthy();
    const list = docs.json?.documents ?? [];
    const insuranceTerms = list.find((d: any) => d?.document_type === "insurance_terms");
    expect(insuranceTerms).toBeTruthy();
    expect(String(insuranceTerms.url || "")).toContain("documents");
  });

  test("pkt 2: po rezerwacji z ubezpieczeniami typ 2/3 zakładka ubezpieczenia widzi uczestników (nie ma komunikatu 'Brak uczestników…')", async ({
    page,
  }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Ins Participants ${Date.now()}`,
      slug: uniq.tripSlug,
      is_public: true,
    });
    created.tripId = trip.id;

    const v2 = await createTestInsuranceVariant({ type: 2, name: `Typ2 ${Date.now()}` });
    const v3 = await createTestInsuranceVariant({ type: 3, name: `Typ3 ${Date.now()}` });
    created.insuranceVariantIds.push(v2.id, v3.id);

    const tiv2 = await createTestTripInsuranceVariant({
      tripId: trip.id,
      variantId: v2.id,
      price_grosz: 1000,
    });
    const tiv3 = await createTestTripInsuranceVariant({
      tripId: trip.id,
      variantId: v3.id,
      price_grosz: 2000,
    });

    const booking = await createTestBooking(trip.id, {
      booking_ref: uniq.bookingRef,
      contact_email: uniq.email,
      status: "confirmed",
      payment_status: "paid",
    });
    created.bookingId = booking.id;

    const participants = await createTestParticipants(booking.id, [
      { first_name: "A", last_name: "A" },
      { first_name: "B", last_name: "B" },
    ]);

    // selected_services → participant_insurances sync dzieje się przez API (w backfillu na zakładce),
    // więc ustawiamy selected_services tak, by dało się to zsynchronizować.
    await setParticipantSelectedServices(participants[0].id, {
      insurances: [{ service_id: buildSyncedInsuranceServiceId(tiv2.id), price_cents: 1000 }],
    });
    await setParticipantSelectedServices(participants[1].id, {
      insurances: [{ service_id: buildSyncedInsuranceServiceId(tiv3.id), price_cents: 2000 }],
    });

    await selectTrip(page, trip.title);
    await page.goto("/trip-dashboard/ubezpieczenia", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    // Wymóg z uwagi: system nie może twierdzić, że brak uczestników.
    await expect(page.getByText(/Brak uczestników z aktywnymi rezerwacjami/i)).toHaveCount(0);

    // Dodatkowo: typ 2 pokazuje listę uczestników z ubezpieczeniem (count > 0)
    await page.getByRole("tab", { name: /Typ 2/i }).click();
    await page.waitForTimeout(1200);
    await expect(page.getByText(/Uczestnicy z ubezpieczeniem dodatkowym/i)).toBeVisible();
    // Powinno znaleźć co najmniej jednego uczestnika po nazwisku
    await expect(page.getByText(/A A|B B/)).toBeVisible();
  });
});

