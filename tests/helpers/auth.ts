import { Page } from '@playwright/test';

/**
 * Helper do logowania użytkownika w testach
 * Uwaga: Wymaga prawidłowych credentials w zmiennych środowiskowych:
 * TEST_USER_EMAIL i TEST_USER_PASSWORD
 */
export async function loginUser(page: Page, email?: string, password?: string) {
  const testEmail = email || process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = password || process.env.TEST_USER_PASSWORD || 'test123456';

  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/hasło|password/i).fill(testPassword);
  await page.getByRole('button', { name: /zaloguj/i }).click();
  
  // Poczekaj na przekierowanie
  await page.waitForURL(/\/(trip-dashboard|admin|coord)/);
}

/**
 * Helper do wylogowania użytkownika
 */
export async function logoutUser(page: Page) {
  // Szukaj przycisku wylogowania - może być w różnych miejscach
  const logoutButton = page.getByRole('button', { name: /wyloguj|logout/i }).first();
  
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL('/');
  }
}

/**
 * Sprawdź czy użytkownik jest zalogowany
 */
export async function isUserLoggedIn(page: Page): Promise<boolean> {
  // Sprawdź czy jesteśmy na stronie wymagającej logowania
  const url = page.url();
  return url.includes('/trip-dashboard') || url.includes('/admin') || url.includes('/coord');
}
