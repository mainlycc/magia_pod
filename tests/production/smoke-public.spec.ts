import { test, expect } from "@playwright/test";

test.describe("Produkcja — strony publiczne", () => {
  test("strona główna ładuje się i ma formularz logowania", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Witamy!" })).toBeVisible();
    await expect(
      page.getByText("Zaloguj się, aby uzyskać dostęp do panelu"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Zobacz wycieczki" })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /zaloguj/i })).toBeVisible();
  });

  test("lista wycieczek /trip ładuje się (HTTP 200)", async ({ page }) => {
    const response = await page.goto("/trip");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/trip/);
  });

  test('link "Zobacz wycieczki" prowadzi do /trip', async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Zobacz wycieczki" }).click();
    await page.waitForURL(/\/trip/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/trip/);
  });

  test("strona logowania /auth/login jest dostępna", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /zaloguj/i })).toBeVisible();
  });

  test("opcjonalnie: strona wycieczki po slug ładuje się", async ({ page }) => {
    const slug = process.env.PRODUCTION_TRIP_SLUG?.trim();
    test.skip(!slug, "Ustaw PRODUCTION_TRIP_SLUG w .env.production.test");

    const response = await page.goto(`/trip/${slug}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
