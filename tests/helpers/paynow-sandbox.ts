import { expect, type Page } from "@playwright/test";

/**
 * Próba dokończenia płatności w Paynow sandbox (zewnętrzna strona).
 * Sandbox UI bywa zmienny — obsługujemy kilka wariantów przycisków.
 */
export async function completePaynowSandboxPayment(page: Page): Promise<void> {
  await page.waitForURL(/paynow/i, { timeout: 60_000 });

  const candidates = [
    page.getByRole("button", { name: /zapłać|pay|potwierdź|confirm|autoryzuj|symuluj/i }),
    page.getByRole("link", { name: /zapłać|pay|potwierdź|confirm/i }),
    page.locator('button[type="submit"]'),
  ];

  for (const locator of candidates) {
    const first = locator.first();
    if (await first.isVisible({ timeout: 5000 }).catch(() => false)) {
      await first.click();
      break;
    }
  }

  const blikInput = page.locator('input[name*="blik"], input[placeholder*="BLIK"]').first();
  if (await blikInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await blikInput.fill("123456");
    await page.getByRole("button", { name: /zapłać|potwierdź|dalej/i }).first().click();
  }

  await page.waitForURL(/magia-pod\.vercel\.app\/booking\//, { timeout: 120_000 });
  expect(page.url()).toMatch(/\/booking\//);
}
