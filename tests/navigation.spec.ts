import { test, expect } from '@playwright/test';

test.describe('Nawigacja publiczna', () => {
  test('strona logowania powinna być dostępna', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Sprawdź czy strona się załadowała
    await expect(page.getByLabel(/email/i)).toBeVisible();
    
    // Sprawdź link do wycieczek
    await expect(page.getByRole('link', { name: 'Zobacz wycieczki' })).toBeVisible();
  });

  test('strona rejestracji powinna być dostępna', async ({ page }) => {
    await page.goto('/auth/sign-up');
    
    // Sprawdź czy formularz rejestracji jest widoczny
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('strona z wycieczkami powinna być dostępna', async ({ page }) => {
    await page.goto('/trip');
    
    // Strona powinna się załadować (może być pusta jeśli nie ma wycieczek)
    await expect(page).toHaveURL('/trip');
  });

  test('strona przypomnij hasło powinna być dostępna', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    // Sprawdź czy jest formularz resetowania hasła
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});

test.describe('Responsywność', () => {
  test('strona główna powinna działać na urządzeniach mobilnych', async ({ page }) => {
    // Ustaw viewport na telefon
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Sprawdź czy elementy są widoczne
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('strona główna powinna działać na tabletach', async ({ page }) => {
    // Ustaw viewport na tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
  });
});
