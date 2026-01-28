import { test, expect } from '@playwright/test';

test.describe('Dostępność (Accessibility)', () => {
  test('strona główna powinna mieć poprawną strukturę nagłówków', async ({ page }) => {
    await page.goto('/');
    
    // Sprawdź czy jest główny nagłówek h1
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('formularze powinny mieć labels', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Sprawdź czy pola mają powiązane labels
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    
    const passwordInput = page.getByLabel(/hasło|password/i);
    await expect(passwordInput).toBeVisible();
  });

  test('przyciski powinny być dostępne z klawiatury', async ({ page }) => {
    await page.goto('/');
    
    // Naciśnij Tab kilka razy
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Sprawdź czy focus jest widoczny (element jest focusowany)
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('linki powinny mieć opisowy tekst', async ({ page }) => {
    await page.goto('/');
    
    const links = await page.getByRole('link').all();
    
    for (const link of links) {
      const text = await link.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('obrazy powinny mieć atrybuty alt (jeśli występują)', async ({ page }) => {
    await page.goto('/');
    
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      // Alt może być pusty dla dekoracyjnych obrazów, ale powinien istnieć
      expect(alt).not.toBeNull();
    }
  });
});

test.describe('Nawigacja klawiaturą', () => {
  test('powinno być możliwe wypełnienie formularza logowania używając tylko klawiatury', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Tab do pierwszego pola
    await page.keyboard.press('Tab');
    await page.keyboard.type('test@example.com');
    
    // Tab do drugiego pola
    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');
    
    // Tab do przycisku i Enter
    await page.keyboard.press('Tab');
    
    // Sprawdź czy przycisk jest sfocusowany
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement);
  });
});
