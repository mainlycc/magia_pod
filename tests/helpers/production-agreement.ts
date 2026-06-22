import { expect, type Page } from "@playwright/test";
import {
  addCustomTableField,
  agreementValueInputs,
  deleteFieldByLabel,
  goToAgreementPreviewOnReserve,
  pdfBufferContainsText,
  saveAgreementTemplate,
} from "./agreement-test-helpers";
import { selectTripInDashboard } from "./production-dashboard";

export { goToAgreementPreviewOnReserve, pdfBufferContainsText };

export async function getSelectedTripId(page: Page): Promise<string> {
  const combo = page.getByRole("combobox").first();
  await expect(combo).toBeVisible({ timeout: 15_000 });
  const value = await combo.inputValue();
  expect(value?.trim(), "Brak wybranej wycieczki w panelu").toBeTruthy();
  return value!;
}

export async function fetchAgreementTemplateHtml(
  page: Page,
  tripId: string,
  type: "individual" | "company" = "individual",
): Promise<string | null> {
  const res = await page.request.get(`/api/trips/${tripId}/agreement-templates`);
  expect(res.ok(), `GET agreement-templates → ${res.status()}`).toBeTruthy();
  const data = (await res.json()) as { individual: string | null; company: string | null };
  return data[type];
}

export async function patchAgreementTemplateHtml(
  page: Page,
  tripId: string,
  html: string,
  type: "individual" | "company" = "individual",
) {
  const res = await page.request.patch(`/api/trips/${tripId}/agreement-templates`, {
    headers: { "Content-Type": "application/json" },
    data: { registration_type: type, template_html: html },
  });
  expect(res.ok(), `PATCH agreement-templates → ${res.status()}`).toBeTruthy();
}

export async function waitForAgreementEditorReady(page: Page) {
  await expect(page.getByRole("heading", { name: /wzór umowy/i })).toBeVisible({
    timeout: 20_000,
  });
  const spinner = page.locator("main svg.animate-spin, main [class*='animate-spin']");
  await spinner.waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {});
  await expect(page.getByText(/edytor szablonu umowy/i)).toBeVisible({ timeout: 45_000 });
  await agreementValueInputs(page).first().waitFor({ state: "visible", timeout: 45_000 });
}

export async function openAgreementEditorForSlug(page: Page, slug: string) {
  await selectTripInDashboard(page, slug);
  await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded" });
  await waitForAgreementEditorReady(page);
}

export async function addCustomFieldAndSave(page: Page, label: string, marker: string) {
  await addCustomTableField(page, label, marker);
  await saveAgreementTemplate(page);
  await page.waitForTimeout(800);
}

export async function removeCustomFieldAndSave(page: Page, labelPattern: RegExp) {
  const removed = await deleteFieldByLabel(page, labelPattern);
  expect(removed, `Nie znaleziono pola do usunięcia: ${labelPattern}`).toBeTruthy();
  await saveAgreementTemplate(page);
  await page.waitForTimeout(800);
}

export async function expectMarkerInDashboardPreview(page: Page, marker: string) {
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
}

export async function isPublicAgreementApiAvailable(
  page: Page,
  slug: string,
): Promise<boolean> {
  const res = await page.request.get(`/api/trips/by-slug/${slug}/agreement-templates`);
  return res.ok();
}

export async function expectMarkerOnReservePreview(page: Page, slug: string, marker: string) {
  const apiOk = await isPublicAgreementApiAvailable(page, slug);
  if (!apiOk) {
    console.warn(
      `[PROD-UMOWA] API /agreement-templates zwraca ${(await page.request.get(`/api/trips/by-slug/${slug}/agreement-templates`)).status()} — wymaga deployu poprawki is_public`,
    );
  }
  await goToAgreementPreviewOnReserve(page, slug);
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
}

export async function expectMarkerAbsentOnReservePreview(page: Page, slug: string, marker: string) {
  await goToAgreementPreviewOnReserve(page, slug);
  await expect(page.getByText(marker)).toHaveCount(0);
}

export async function findBookingIdByEmail(page: Page, email: string): Promise<string> {
  await page.goto("/trip-dashboard/rezerwacje", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/ładowanie/i)).not.toBeVisible({ timeout: 30_000 }).catch(() => {});
  await expect(page.getByText(email).first()).toBeVisible({ timeout: 30_000 });

  const row = page.locator("tr").filter({ hasText: email }).first();
  const link = row.getByRole("link", { name: /szczegóły/i });
  await expect(link).toBeVisible({ timeout: 10_000 });
  const href = await link.getAttribute("href");
  const match = href?.match(/rezerwacje\/([a-f0-9-]+)/i);
  expect(match?.[1], `Brak ID rezerwacji w linku: ${href}`).toBeTruthy();
  return match![1];
}

export async function generateAgreementPdfForBooking(
  page: Page,
  bookingId: string,
): Promise<string> {
  const res = await page.request.post(`/api/bookings/${bookingId}/agreement`);
  expect(res.ok(), `POST agreement → ${res.status()} ${await res.text().catch(() => "")}`).toBeTruthy();
  const data = (await res.json()) as { filename?: string };
  expect(data.filename, "Brak filename w odpowiedzi generowania umowy").toBeTruthy();
  return data.filename!;
}

export async function downloadAgreementPdf(page: Page, filename: string): Promise<Buffer> {
  const res = await page.request.get(`/api/agreements/${encodeURIComponent(filename)}`);
  expect(res.ok(), `GET PDF → ${res.status()}`).toBeTruthy();
  const buf = Buffer.from(await res.body());
  expect(buf.length).toBeGreaterThan(500);
  return buf;
}
