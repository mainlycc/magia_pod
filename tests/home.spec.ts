import { test, expect } from '@playwright/test';

test.describe('Strona główna', () => {
  test('powinien wyświetlić stronę główną z formularzem logowania', async ({ page }) => {
    await page.goto('/');

    // Sprawdź tytuł strony
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    
    // Sprawdź czy jest tekst powitalny
    await expect(page.getByText('Zaloguj się, aby uzyskać dostęp do panelu')).toBeVisible();
    
    // Sprawdź czy jest przycisk do wycieczek
    await expect(page.getByRole('link', { name: 'Zobacz wycieczki' })).toBeVisible();
  });

  test('powinien mieć przełącznik motywu', async ({ page }) => {
    await page.goto('/');
    
    // Szukaj przycisku przełącznika motywu (theme switcher)
    const themeButton = page.locator('footer').getByRole('button').first();
    await expect(themeButton).toBeVisible();
  });

  test('powinien móc przejść do strony z wycieczkami', async ({ page }) => {
    await page.goto('/');
    
    // Kliknij przycisk "Zobacz wycieczki"
    await page.getByRole('link', { name: 'Zobacz wycieczki' }).click();
    
    // Sprawdź czy URL się zmienił
    await expect(page).toHaveURL('/trip');
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
