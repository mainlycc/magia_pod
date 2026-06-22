import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

/**
 * Testy E2E przeciwko wdrożonej aplikacji (np. Vercel).
 * Nie uruchamia lokalnego dev servera.
 *
 * Uruchomienie:
 *   pnpm test:e2e:production:env   — weryfikacja .env.production.test
 *   pnpm test:e2e:production       — smoke na https://magia-pod.vercel.app
 */
dotenv.config({ path: path.resolve(__dirname, ".env.production.test") });

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() || "https://magia-pod.vercel.app";

export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["html", { outputFolder: "playwright-report-production" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
