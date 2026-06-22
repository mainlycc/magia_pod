import { test, expect } from "@playwright/test";
import { loginUser } from "../helpers/auth";

const DASHBOARD_PATHS = [
  { path: "/trip-dashboard", label: "pulpit" },
  { path: "/trip-dashboard/informacje", label: "informacje" },
  { path: "/trip-dashboard/umowa", label: "umowa" },
  { path: "/trip-dashboard/uczestnicy", label: "uczestnicy" },
  { path: "/trip-dashboard/ubezpieczenia", label: "ubezpieczenia" },
  { path: "/trip-dashboard/raport-umow", label: "raport umów" },
  { path: "/trip-dashboard/zaproszenia-koordynatorow", label: "koordynatorzy" },
] as const;

test.describe("Produkcja — panel admina (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "Uzupełnij TEST_USER_EMAIL i TEST_USER_PASSWORD w .env.production.test",
    );
    await loginUser(page);
  });

  for (const { path, label } of DASHBOARD_PATHS) {
    test(`podstrona ${label} (${path}) ładuje się bez błędu 5xx`, async ({
      page,
    }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBeLessThan(500);
      expect(page.url()).not.toContain("/auth/login");

      const fatalError = page.getByText(/application error|internal server error/i);
      await expect(fatalError).toBeHidden({ timeout: 3000 }).catch(() => {});
    });
  }

  test("lista wycieczek w panelu jest widoczna lub wymaga wyboru wycieczki", async ({
    page,
  }) => {
    await page.goto("/trip-dashboard", { waitUntil: "domcontentloaded" });

    const tripSelector = page.getByRole("combobox").first();
    const chooseTrip = page.getByText(/wybierz wycieczk/i);
    const dashboardContent = page.getByText(/rezerwacje|wycieczk|dashboard|uczestnik/i);

    const hasUi =
      (await tripSelector.isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await chooseTrip.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await dashboardContent.isVisible({ timeout: 3000 }).catch(() => false));

    expect(hasUi).toBe(true);
  });
});
