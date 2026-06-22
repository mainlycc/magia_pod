import { test, expect } from "@playwright/test";
import { loginUser, verifyAdminAccess } from "../helpers/auth";

test.describe("Produkcja — logowanie admina", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "Uzupełnij TEST_USER_EMAIL i TEST_USER_PASSWORD w .env.production.test",
    );
  });

  test("admin loguje się i trafia do trip-dashboard", async ({ page }) => {
    await loginUser(page);

    await expect(page).toHaveURL(/\/(trip-dashboard|coord)/);
    expect(page.url()).not.toContain("/auth/login");
  });

  test("po logowaniu panel admina jest dostępny", async ({ page }) => {
    await loginUser(page);

    const hasAccess = await verifyAdminAccess(page);
    expect(hasAccess).toBe(true);
  });

  test("niezalogowany użytkownik jest przekierowany z trip-dashboard", async ({
    page,
  }) => {
    await page.goto("/trip-dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/(auth\/login|trip-dashboard)/, { timeout: 15_000 });

    const url = page.url();
    const redirectedToLogin = url.includes("/auth/login");
    const stayedOnDashboard = url.includes("/trip-dashboard");

    expect(redirectedToLogin || stayedOnDashboard).toBe(true);
    if (stayedOnDashboard) {
      const loginForm = page.getByLabel(/email/i);
      const onLogin = await loginForm.isVisible({ timeout: 3000 }).catch(() => false);
      expect(onLogin || redirectedToLogin).toBeTruthy();
    }
  });
});
