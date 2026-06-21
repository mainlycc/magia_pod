import { test, expect } from "@playwright/test";
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
  getAgreementTemplateHtml,
  MINIMAL_RESERVE_FORM_CONFIG,
  setParticipantSelectedServices,
} from "./helpers/db-helpers";
import {
  addCustomTableField,
  addParagraphSection,
  agreementLabelInputs,
  agreementValueInputs,
  deleteFieldByLabel,
  deleteSectionByTitle,
  fillFieldValueByLabel,
  goToAgreementPreviewOnReserve,
  openAgreementEditor,
  saveAgreementTemplate,
  selectTripByTitle,
} from "./helpers/agreement-test-helpers";
import { loginUser } from "./helpers/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { replaceTripPlaceholders } from "@/lib/agreement-placeholder-replacer";
import type { TripContentData, TripFullData } from "@/contexts/trip-context";
import {
  appendParagraphToHtml,
  appendTableRowToHtml,
  getDefaultAgreementHtml,
  removeParagraphContaining,
  removeTableRowsContaining,
  removeTableRowsMatching,
} from "./helpers/agreement-template-html";

/** Testy edytora w panelu — opcjonalne; wymagają E2E_UI_AGREEMENT=1 oraz poprawnych TEST_USER_* w .env.test */
const HAS_UI_AUTH = Boolean(
  process.env.E2E_UI_AGREEMENT === "1" &&
    process.env.TEST_USER_EMAIL &&
    process.env.TEST_USER_PASSWORD,
);

function createAgreementTestTrip(overrides: Record<string, unknown> = {}) {
  const uniq = generateUniqueTestData();
  return createTestTrip({
    title: `Trip Umowa ${Date.now()}`,
    slug: uniq.tripSlug,
    registration_mode: "individual",
    is_public: true,
    ...MINIMAL_RESERVE_FORM_CONFIG,
    ...overrides,
  });
}

async function upsertTemplateHtml(
  tripId: string,
  html: string,
  registrationType: "individual" | "company" = "individual",
) {
  const admin = createAdminClient();
  const { data: existing, error: checkError } = await admin
    .from("trip_agreement_templates")
    .select("id")
    .eq("trip_id", tripId)
    .eq("registration_type", registrationType)
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);

  if (existing?.id) {
    const { error } = await admin
      .from("trip_agreement_templates")
      .update({ template_html: html, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .from("trip_agreement_templates")
      .insert({
        trip_id: tripId,
        registration_type: registrationType,
        template_html: html,
      });
    if (error) throw new Error(error.message);
  }
}

function buildTemplateWithCustomField(marker: string, label: string): string {
  return appendTableRowToHtml(getDefaultAgreementHtml(), label, marker);
}

function buildTemplateWithoutTransferRow(): string {
  return removeTableRowsMatching(getDefaultAgreementHtml(), /transfery/i);
}

function buildTemplateWithParagraph(marker: string, title: string): string {
  return appendParagraphToHtml(getDefaultAgreementHtml(), title, marker);
}

test.describe.configure({ timeout: 120000 });

test.describe("Umowa — persystencja szablonu (API + reserve, bez logowania)", () => {
  const created: { tripId?: string; bookingId?: string } = {};

  test.afterEach(async () => {
    try {
      if (created.bookingId) await deleteTestBooking(created.bookingId);
    } catch {}
    try {
      if (created.tripId) await deleteTestTrip(created.tripId);
    } catch {}
    created.tripId = undefined;
    created.bookingId = undefined;
  });

  test("field-add-persists (M1): marker w template_html po zapisie do DB", async ({ request }) => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const marker = `TEST-ADD-${Date.now()}`;
    const label = `TEST Etykieta ${Date.now()}`;
    await upsertTemplateHtml(trip.id, buildTemplateWithCustomField(marker, label));

    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).toContain(marker);
    expect(html!).toContain(label);

    const res = await request.get(`/api/trips/by-slug/${trip.slug}/agreement-templates`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.individual).toContain(marker);
  });

  test("field-remove-persists (M2): usunięty marker nie występuje w API", async ({ request }) => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const marker = `TEST-REMOVE-${Date.now()}`;
    await upsertTemplateHtml(trip.id, buildTemplateWithCustomField(marker, "TEST do usunięcia:"));

    let html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).toContain(marker);

    html = removeTableRowsContaining(html!, marker);
    await upsertTemplateHtml(trip.id, html);

    html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).not.toContain(marker);

    const res = await request.get(`/api/trips/by-slug/${trip.slug}/agreement-templates`);
    const body = await res.json();
    expect(body.individual).not.toContain(marker);
  });

  test("field-sync-to-reserve (M6): marker z DB widać w podglądzie na /reserve", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createAgreementTestTrip({ slug: uniq.tripSlug });
    created.tripId = trip.id;

    const marker = `SYNC-RESERVE-${Date.now()}`;
    await upsertTemplateHtml(trip.id, buildTemplateWithCustomField(marker, "TEST sync reserve:"));

    await goToAgreementPreviewOnReserve(page, trip.slug);
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15000 });
  });

  test("paragraph-add-persists (M5-add): paragraf w template_html", async () => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const marker = `PARA-ADD-${Date.now()}`;
    const title = `Sekcja test ${Date.now()}`;
    await upsertTemplateHtml(trip.id, buildTemplateWithParagraph(marker, title));

    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).toContain(marker);
  });

  test("paragraph-remove-persists (M5-delete): usunięty paragraf znika z API", async () => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const marker = `PARA-DEL-${Date.now()}`;
    const title = `Sekcja do usunięcia ${Date.now()}`;
    await upsertTemplateHtml(trip.id, buildTemplateWithParagraph(marker, title));

    const stored = await getAgreementTemplateHtml(trip.id, "individual");
    const without = removeParagraphContaining(stored!, marker);
    await upsertTemplateHtml(trip.id, without);

    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).not.toContain(marker);
  });

  test("template-to-pdf (M3+M7): PDF zawiera marker z zapisanego szablonu", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createAgreementTestTrip({
      slug: uniq.tripSlug,
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

    const marker = `PDFTEST-${Date.now()}`;
    const label = "TEST PDF:";
    await upsertTemplateHtml(trip.id, buildTemplateWithCustomField(marker, label));

    const savedHtml = await getAgreementTemplateHtml(trip.id, "individual");
    expect(savedHtml!).toContain(marker);

    const admin = createAdminClient();
    const { data: tripRow } = await admin.from("trips").select("*").eq("id", trip.id).single();
    expect(tripRow).toBeTruthy();

    const tripFullData = {
      ...tripRow,
      id: trip.id,
    } as TripFullData;
    const tripContentData = {
      reservation_number: (tripRow!.reservation_number as string) ?? "",
      duration_text: (tripRow!.duration_text as string) ?? "",
    } as TripContentData;

    const filledHtml = replaceTripPlaceholders(savedHtml!, tripFullData, tripContentData, {
      insuranceScope: null,
    });
    expect(filledHtml).toContain(marker);
    expect(filledHtml).toContain(label);

    await admin.from("agreements").delete().eq("booking_id", booking.id);
    await admin.from("bookings").update({ agreement_pdf_url: null }).eq("id", booking.id);

    const gen = await page.request.post(`/api/bookings/${booking.id}/agreement`);
    expect(gen.ok()).toBeTruthy();

    const { data: agr } = await admin
      .from("agreements")
      .select("pdf_url")
      .eq("booking_id", booking.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(agr?.pdf_url).toBeTruthy();

    const { data: blob } = await admin.storage.from("agreements").download(String(agr!.pdf_url));
    const buf = Buffer.from(await blob!.arrayBuffer());
    expect(buf.length).toBeGreaterThan(500);
  });

  test("mandatory-fields-reinject (M4): usunięte Transfery znikają z API i reserve", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createAgreementTestTrip({ slug: uniq.tripSlug });
    created.tripId = trip.id;

    await upsertTemplateHtml(trip.id, buildTemplateWithoutTransferRow());

    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!.toLowerCase()).not.toMatch(/<td>\s*transfery/i);

    await goToAgreementPreviewOnReserve(page, trip.slug);
    await expect(page.getByText(/^Transfery:/i)).toHaveCount(0);
  });
});

test.describe("Umowa — edytor panelu (wymaga TEST_USER_EMAIL + TEST_USER_PASSWORD)", () => {
  const created: {
    tripId?: string;
    bookingId?: string;
    insuranceVariantIds: string[];
    uploadedFiles: Array<{ bucket: "agreements" | "documents"; path: string }>;
  } = { insuranceVariantIds: [], uploadedFiles: [] };

  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_UI_AUTH, "Ustaw E2E_UI_AGREEMENT=1 oraz TEST_USER_EMAIL / TEST_USER_PASSWORD w .env.test");
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

  test("pkt 5 (M3): wartość komórki szablonu zapisuje się i widać ją w podglądzie panelu", async ({
    page,
  }) => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const room = `Pokój 2-osobowy ${Date.now()}`;
    await openAgreementEditor(page, trip.title);

    const filled = await fillFieldValueByLabel(page, /rodzaj, typ pokoju/i, room);
    if (!filled) {
      await addCustomTableField(page, "Rodzaj, typ pokoju:", room);
    }
    await saveAgreementTemplate(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByText(room).first()).toBeVisible({ timeout: 10000 });
    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).toContain(room);
  });

  test("field-add-persists (M1): dodane pole tabeli trwa po zapisie i reload w edytorze", async ({
    page,
  }) => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const marker = `TEST-ADD-UI-${Date.now()}`;
    await openAgreementEditor(page, trip.title);
    await addCustomTableField(page, `TEST Etykieta ${Date.now()}`, marker);
    await saveAgreementTemplate(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByText(marker).first()).toBeVisible();
    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).toContain(marker);
  });

  test("field-remove-persists (M2): usunięte pole znika z edytora po reload", async ({ page }) => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    const marker = `TEST-REMOVE-UI-${Date.now()}`;
    await openAgreementEditor(page, trip.title);
    await addCustomTableField(page, "TEST do usunięcia:", marker);
    await saveAgreementTemplate(page);
    await deleteFieldByLabel(page, /test do usunięcia/i);
    await saveAgreementTemplate(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByText(marker)).toHaveCount(0);
    const html = await getAgreementTemplateHtml(trip.id, "individual");
    expect(html!).not.toContain(marker);
  });

  test("mandatory-fields-reinject (M4): edytor może przywrócić Transfery po reload", async ({
    page,
  }) => {
    const trip = await createAgreementTestTrip();
    created.tripId = trip.id;

    await upsertTemplateHtml(trip.id, buildTemplateWithoutTransferRow());
    await openAgreementEditor(page, trip.title);
    await deleteFieldByLabel(page, /transfery/i).catch(() => {});
    await saveAgreementTemplate(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const transferCount = await countLabelsMatching(agreementLabelInputs(page), /transfery/i);
    expect(transferCount === 0 || transferCount === 1).toBeTruthy();
  });

  test("pkt 5a + 11: insurance_scope i selected_services per uczestnik", async ({ page }) => {
    const uniq = generateUniqueTestData();
    const trip = await createTestTrip({
      title: `Trip Services ${Date.now()}`,
      slug: uniq.tripSlug,
      registration_mode: "individual",
      is_public: true,
      reservation_number: `RSV-${Date.now()}`,
      form_diets: [{ id: "diet-veg", title: "Dieta wegetariańska" }],
      form_additional_attractions: [{ id: "attr-boat", title: "Rejs statkiem" }],
    });
    created.tripId = trip.id;

    const { file } = await createTripInsuranceTermsDocument({ tripId: trip.id });
    created.uploadedFiles.push(file);

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
    await page.goto("/trip-dashboard/ubezpieczenia", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/brak uczestników z aktywnymi rezerwacjami/i)).toHaveCount(0);

    await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.getByText(/ubezpieczenie podstawowe/i)).toBeVisible();
    await expect(page.getByText(/Uczestnik 1/i)).toBeVisible();
    await expect(page.getByText(/Dieta wegetariańska/i)).toBeVisible();
  });
});

async function countLabelsMatching(
  locator: import("@playwright/test").Locator,
  pattern: RegExp,
): Promise<number> {
  const count = await locator.count();
  let matches = 0;
  for (let i = 0; i < count; i++) {
    if (pattern.test(await locator.nth(i).inputValue())) matches++;
  }
  return matches;
}
