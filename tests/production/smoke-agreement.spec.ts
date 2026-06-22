import { test, expect, type Page } from "@playwright/test";
import { loginUser } from "../helpers/auth";

async function waitForAgreementPageReady(page: Page) {
  await expect(page.getByRole("heading", { name: /wzór umowy/i })).toBeVisible({
    timeout: 20_000,
  });
  const spinner = page.locator("main svg.animate-spin, main [class*='animate-spin']");
  await spinner.waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {});
  await page
    .getByText(/edytor szablonu umowy|pola umowy|podgląd poniżej|placeholder/i)
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });
}

test.describe("Produkcja — zakładka Umowa", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "Uzupełnij TEST_USER_EMAIL i TEST_USER_PASSWORD w .env.production.test",
    );
    await loginUser(page);
    await page.goto("/trip-dashboard/umowa", { waitUntil: "domcontentloaded" });
  });

  test("strona umowy ładuje się po zalogowaniu", async ({ page }) => {
    expect(page.url()).not.toContain("/auth/login");
    await waitForAgreementPageReady(page);
    await expect(page.getByText(/edytor szablonu umowy/i)).toBeVisible();
  });

  test("po wyborze wycieczki widać pola pokój / posiłki / transfery (po wdrożeniu)", async ({
    page,
  }) => {
    await waitForAgreementPageReady(page);

    const roomField = page.getByLabel(/rodzaj, typ pokoju/i);
    const hasNewFields = await roomField.isVisible({ timeout: 5000 }).catch(() => false);

    test.skip(
      !hasNewFields,
      "Pola umowy (room_type/meals_info/transfer_info) nie są jeszcze na produkcji — wymaga deploy",
    );

    await expect(page.getByLabel(/ilość, rodzaj posiłków/i)).toBeVisible();
    await expect(page.getByLabel(/^transfery$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /zapisz pola umowy/i })).toBeVisible();
  });

  test("podgląd umowy nie zawiera surowego placeholdera room_type", async ({ page }) => {
    await waitForAgreementPageReady(page);

    const content = await page.content();
    expect(content).not.toMatch(/\{\{room_type\}\}/);
  });
});
