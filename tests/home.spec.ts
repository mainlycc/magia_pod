import { test, expect } from '@playwright/test';

test.describe('Strona główna', () => {
  test('powinien wyświetlić stronę główną z formularzem logowania', async ({ page }) => {
    await page.goto('/');

    // Sprawdź tytuł strony
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    
    // Sprawdź czy jest tekst powitalny
    await expect(page.getByText('Zaloguj się, aby uzyskać dostęp do panelu')).toBeVisible();
  });

  test('powinien mieć formularz logowania', async ({ page }) => {
    await page.goto('/');
    
    // Sprawdź czy są pola formularza
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/hasło|password/i)).toBeVisible();
    
    // Sprawdź czy jest przycisk logowania
    await expect(page.getByRole('button', { name: /zaloguj/i })).toBeVisible();
  });
});
