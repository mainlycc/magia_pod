import { test, expect } from "@playwright/test";
import { createTestTrip, deleteTestTrip, createTestUser, deleteTestUser, setTestUserPassword } from "./helpers/db-helpers";

test.describe("Koordynator — logowanie i dostęp (pkt 6)", () => {
  let tripId: string | null = null;
  let userId: string | null = null;
  let email: string | null = null;
  const password = "TestPassword123!";

  test.afterEach(async () => {
    try {
      if (userId) await deleteTestUser(userId);
    } catch {}
    try {
      if (tripId) await deleteTestTrip(tripId);
    } catch {}
    tripId = null;
    userId = null;
    email = null;
  });

  test("koordynator może się zalogować i wejść do /coord (a konto działa)", async ({ page }) => {
    const trip = await createTestTrip({
      title: `Trip Coord ${Date.now()}`,
      slug: `trip-coord-${Date.now()}`,
      is_public: false,
    });
    tripId = trip.id;

    const user = await createTestUser({
      role: "coordinator",
      allowed_trip_ids: [trip.id],
    });
    userId = user!.id;
    email = user!.email!;

    // Symulacja „resetu hasła” z perspektywy systemu (ustawienie hasła przez admin API),
    // a następnie realne logowanie przez UI.
    await setTestUserPassword(user!.id, password);

    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(email);
    await page.locator("input#password").fill(password);
    await page.getByRole("button", { name: /zaloguj/i }).click();

    await page.waitForURL(/\/(coord|trip-dashboard|admin)/, { timeout: 15000 });
    expect(page.url()).toContain("/coord");

    await page.goto("/coord", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/koordynator|wycieczk/i)).toBeVisible();
  });
});

