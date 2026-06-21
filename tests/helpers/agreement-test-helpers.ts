import { expect, type Page } from "@playwright/test";

export async function selectTripByTitle(page: Page, tripTitle: string) {
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

export async function openAgreementEditor(page: Page, tripTitle: string) {
  await selectTripByTitle(page, tripTitle);
  await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded", timeout: 15000 });
  await expect(agreementValueInputs(page).first()).toBeVisible({ timeout: 15000 });
}

export function agreementValueInputs(page: Page) {
  return page.locator('input[placeholder="Wartość lub {{placeholder}}..."]');
}

export function agreementLabelInputs(page: Page) {
  return page.locator('input[placeholder="Etykieta pola..."]');
}

export async function saveAgreementTemplate(page: Page) {
  await page.getByRole("button", { name: /^zapisz$/i }).click();
  await page.waitForTimeout(1200);
}

export async function addCustomTableField(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: /dodaj pole/i }).first().click();
  const labelInput = agreementLabelInputs(page).last();
  const valueInput = agreementValueInputs(page).last();
  await labelInput.fill(label);
  await valueInput.fill(value);
}

export async function fillFieldValueByLabel(page: Page, labelPattern: RegExp, value: string) {
  const labels = agreementLabelInputs(page);
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const val = await labels.nth(i).inputValue();
    if (labelPattern.test(val)) {
      const row = labels.nth(i).locator('xpath=ancestor::div[contains(@class,"grid")]');
      await row.locator('input[placeholder="Wartość lub {{placeholder}}..."]').fill(value);
      return true;
    }
  }
  return false;
}

export async function deleteFieldByLabel(page: Page, labelPattern: RegExp) {
  const labels = agreementLabelInputs(page);
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const val = await labels.nth(i).inputValue();
    if (labelPattern.test(val)) {
      const row = labels.nth(i).locator('xpath=ancestor::div[contains(@class,"grid")]');
      await row.getByRole("button").last().click();
      return true;
    }
  }
  return false;
}

/** Przechodzi od razu do podglądu umowy (?podglad=1 — przykładowe dane, krok podsumowania). */
export async function goToAgreementPreviewOnReserve(page: Page, slug: string) {
  await page.goto(`/trip/${slug}/reserve?podglad=1`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await expect(page.getByText("Tryb podglądu umowy")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Podgląd umowy", { exact: true })).toBeVisible({ timeout: 30000 });
}

export function pdfBufferContainsText(buf: Buffer, text: string): boolean {
  const haystacks = [buf.toString("latin1"), buf.toString("utf8")];
  for (const haystack of haystacks) {
    if (haystack.includes(text)) return true;
    if (haystack.includes(`(${text})`)) return true;
    if (text.length >= 8) {
      const prefix = text.slice(0, 8);
      if (haystack.includes(prefix)) return true;
      if (haystack.includes(`(${prefix}`)) return true;
    }
  }
  return false;
}

export async function addParagraphSection(page: Page, title: string, contentMarker: string) {
  await page.getByRole("button", { name: /dodaj paragraf/i }).click();
  const titleInputs = page.locator(
    'input[placeholder="Tytuł sekcji (opcjonalnie)..."], input[placeholder="Tytuł sekcji (np. Dane Zgłaszającego)..."]',
  );
  await titleInputs.last().fill(title);
  const editor = page.locator(".ProseMirror").last();
  await editor.click();
  await editor.fill(contentMarker);
}

export async function deleteSectionByTitle(page: Page, title: string) {
  const sectionCard = page.locator(".mb-4").filter({
    has: page.locator(`input[value="${title}"]`),
  });
  if ((await sectionCard.count()) === 0) {
    const cards = page.locator(".mb-4");
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      const titleInput = card.locator(
        'input[placeholder="Tytuł sekcji (opcjonalnie)..."], input[placeholder="Tytuł sekcji (np. Dane Zgłaszającego)..."]',
      );
      if ((await titleInput.count()) > 0) {
        const val = await titleInput.inputValue();
        if (val === title) {
          await card.getByRole("button").last().click();
          return true;
        }
      }
    }
    return false;
  }
  await sectionCard.first().getByRole("button").last().click();
  return true;
}
