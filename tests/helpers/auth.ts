import { Page, expect } from '@playwright/test';

/**
 * Helper do logowania użytkownika w testach
 * Uwaga: Wymaga prawidłowych credentials w zmiennych środowiskowych:
 * TEST_USER_EMAIL i TEST_USER_PASSWORD
 */
export async function loginUser(page: Page, email?: string, password?: string) {
  const testEmail = email || process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = password || process.env.TEST_USER_PASSWORD || 'test123456';

  console.log(`[TEST] Próba logowania jako: ${testEmail}`);
  
  // Retry: przy starcie dev servera / w CI zdarza się, że pierwsze przejście na /auth/login
  // trafia w chwilowy loading/blank (zwłaszcza w Firefox/WebKit). Robimy 3 próby.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.locator('input#password');
    const loginButton = page.getByRole('button', { name: /zaloguj/i });

    const ready = await emailInput.isVisible({ timeout: 10000 }).catch(() => false);
    if (ready) {
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await loginButton.waitFor({ state: 'visible', timeout: 10000 });

      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      await expect(loginButton).toBeEnabled({ timeout: 15000 });
      await loginButton.click();
      break;
    }

    if (attempt === 3) {
      await expect(emailInput).toBeVisible({ timeout: 1000 });
    }
  }
  
  // Poczekaj na przekierowanie (login czasem idzie wolniej przy RLS / SSR)
  await page.waitForURL(/\/(trip-dashboard|coord)/, { timeout: 60000 });
  
  const currentUrl = page.url();
  console.log(`[TEST] Zalogowano pomyślnie, przekierowano do: ${currentUrl}`);
  
  // Sprawdź czy nie jesteśmy na stronie logowania (czyli logowanie się powiodło)
  expect(currentUrl).not.toContain('/auth/login');
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
  return url.includes('/trip-dashboard') || url.includes('/coord');
}

/**
 * Sprawdź czy użytkownik jest zalogowany jako admin
 * Przechodzi do trip-dashboard i sprawdza czy ma dostęp
 */
export async function verifyAdminAccess(page: Page): Promise<boolean> {
  try {
    console.log('[TEST] Sprawdzanie dostępu do trip-dashboard...');
    
    try {
      await page.goto('/trip-dashboard', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      console.log('[TEST] Przeszedłem do /trip-dashboard');
    } catch (error: any) {
      const currentUrl = page.url();
      console.log(`[TEST] Timeout podczas ładowania strony. Aktualny URL: ${currentUrl}`);
      
      if (currentUrl.includes('/auth/login')) {
        console.log('[TEST] ❌ Brak dostępu - przekierowano do logowania');
        return false;
      }
      
      return false;
    }
    
    const currentUrl = page.url();
    console.log(`[TEST] Aktualny URL po załadowaniu: ${currentUrl}`);
    
    if (currentUrl.includes('/auth/login')) {
      console.log('[TEST] ❌ Brak dostępu - przekierowano do logowania');
      return false;
    }
    
    if (!currentUrl.includes('/trip-dashboard')) {
      console.log(`[TEST] ❌ Nieoczekiwany URL: ${currentUrl}`);
      return false;
    }
    
    await page.waitForTimeout(1000);
    
    const hasError = await page.getByText(/brak uprawnień|unauthorized|access denied/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    if (hasError) {
      const errorText = await page.getByText(/brak uprawnień|unauthorized|access denied/i)
        .first()
        .textContent()
        .catch(() => '');
      console.log(`[TEST] ❌ Brak uprawnień: ${errorText}`);
      return false;
    }
    
    const hasDashboardContent = await page.getByText(/rezerwacje|wycieczki|dashboard|koordynatorzy/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (hasDashboardContent) {
      console.log('[TEST] ✅ Dostęp do trip-dashboard potwierdzony');
      return true;
    }
    
    console.log('[TEST] ❌ Nie udało się zweryfikować dostępu - brak widocznych elementów panelu');
    return false;
  } catch (error: any) {
    const currentUrl = page.url();
    console.error(`[TEST] ❌ Błąd podczas sprawdzania dostępu. URL: ${currentUrl}`, error.message);
    return false;
  }
}
