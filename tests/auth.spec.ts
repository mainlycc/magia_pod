import { test, expect } from '@playwright/test';

test.describe('Autentykacja - Formularz logowania', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('powinien wyświetlić błąd przy pustych polach', async ({ page }) => {
    // Kliknij przycisk logowania bez wypełniania pól
    await page.getByRole('button', { name: /zaloguj/i }).click();
    
    // Sprawdź czy formularze HTML5 wyświetlają błędy
    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('powinien wyświetlić błąd przy nieprawidłowym emailu', async ({ page }) => {
    // Wprowadź nieprawidłowy email
    await page.getByLabel(/email/i).fill('nieprawidlowy-email');
    await page.getByLabel(/hasło|password/i).fill('haslo123');
    await page.getByRole('button', { name: /zaloguj/i }).click();
    
    // Sprawdź czy jest błąd walidacji
    const emailInput = page.getByLabel(/email/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('formularz powinien mieć wszystkie wymagane pola', async ({ page }) => {
    // Sprawdź obecność pól
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/hasło|password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /zaloguj/i })).toBeVisible();
  });

  test('hasło powinno być ukryte domyślnie', async ({ page }) => {
    const passwordInput = page.getByLabel(/hasło|password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Autentykacja - Formularz rejestracji', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/sign-up');
  });

  test('formularz rejestracji powinien być widoczny', async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('powinien wymagać prawidłowego emaila', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('zly-email');
    
    // Sprawdź walidację HTML5
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });
});

test.describe('Autentykacja - Resetowanie hasła', () => {
  test('formularz resetowania hasła powinien działać', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    // Sprawdź obecność pola email
    await expect(page.getByLabel(/email/i)).toBeVisible();
    
    // Sprawdź przycisk submit
    const submitButton = page.getByRole('button', { name: /wyślij|resetuj|przypomnij/i });
    await expect(submitButton).toBeVisible();
  });

  test('powinien wymagać prawidłowego emaila', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('nieprawidlowy');
    
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });
});

test.describe('Przekierowania dla niezalogowanych użytkowników', () => {
  test('niezalogowany użytkownik nie powinien mieć dostępu do panelu admina', async ({ page }) => {
    await page.goto('/admin');
    
    // Powinien zostać przekierowany do logowania lub strony głównej
    await page.waitForURL(/\/(auth\/login|$)/);
  });

  test('niezalogowany użytkownik nie powinien mieć dostępu do trip-dashboard', async ({ page }) => {
    await page.goto('/trip-dashboard');
    
    // Powinien zostać przekierowany
    await page.waitForURL(/\/(auth\/login|$)/);
  });
});
