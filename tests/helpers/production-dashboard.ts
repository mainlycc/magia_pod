import { expect, type Page } from "@playwright/test";

const SLUG_HINT_STOP_WORDS = new Set(["test"]);

function slugLabelHints(slug: string): string[] {
  return slug
    .split(/[-_]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && !SLUG_HINT_STOP_WORDS.has(p.toLowerCase()));
}

function optionMatches(
  label: string,
  optionValue: string,
  match: string | RegExp,
): boolean {
  if (match instanceof RegExp) {
    return match.test(label) || match.test(optionValue);
  }
  const m = match.toLowerCase();
  if (label.toLowerCase().includes(m) || optionValue.toLowerCase().includes(m)) {
    return true;
  }
  const hints = slugLabelHints(match);
  if (hints.length === 0) return false;
  const labelLower = label.toLowerCase();
  return hints.every((hint) => labelLower.includes(hint.toLowerCase()));
}

/** Wybiera wycieczkę w comboboxie panelu (sidebar). */
export async function selectTripInDashboard(page: Page, match: string | RegExp) {
  await page.goto("/trip-dashboard", { waitUntil: "domcontentloaded" });

  const combo = page.getByRole("combobox").first();
  await expect(combo).toBeVisible({ timeout: 15_000 });

  const options = combo.locator("option");
  await expect
    .poll(async () => options.count(), { timeout: 30_000, message: "Lista wycieczek w panelu" })
    .toBeGreaterThan(1);

  const count = await options.count();
  let value: string | null = null;
  let matchedLabel = "";

  for (let i = 0; i < count; i++) {
    const opt = options.nth(i);
    const label = ((await opt.textContent()) ?? "").trim();
    const optionValue = (await opt.getAttribute("value")) ?? "";
    if (!optionValue.trim()) continue;
    if (optionMatches(label, optionValue, match)) {
      value = optionValue;
      matchedLabel = label;
      break;
    }
  }

  expect(value, `Nie znaleziono wycieczki: ${String(match)}`).toBeTruthy();
  console.log(`[PROD] Panel — wybrano wycieczkę: ${matchedLabel}`);
  await combo.selectOption(value!);
  await page.waitForTimeout(1500);
}