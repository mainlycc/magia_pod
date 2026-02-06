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
  
  await page.goto('/auth/login');
  
  // Sprawdź czy strona logowania się załadowała
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  
  await page.getByLabel(/email/i).fill(testEmail);
  // Używamy ID zamiast label, bo przycisk "Pokaż hasło" też ma label z "hasło"
  await page.locator('input#password').fill(testPassword);
  
  // Poczekaj na przycisk i sprawdź czy nie jest disabled
  const loginButton = page.getByRole('button', { name: /zaloguj/i });
  await expect(loginButton).toBeEnabled({ timeout: 5000 });
  await loginButton.click();
  
  // Poczekaj na przekierowanie
  await page.waitForURL(/\/(trip-dashboard|admin|coord)/, { timeout: 10000 });
  
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
  return url.includes('/trip-dashboard') || url.includes('/admin') || url.includes('/coord');
}

/**
 * Sprawdź czy użytkownik jest zalogowany jako admin
 * Przechodzi do głównego panelu admina (/admin) i sprawdza czy ma dostęp
 */
export async function verifyAdminAccess(page: Page): Promise<boolean> {
  try {
    console.log('[TEST] Sprawdzanie dostępu do panelu admina...');
    
    // Przejdź do głównego panelu admina (nie /admin/trips, bo to stary dashboard)
    try {
      await page.goto('/admin', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      console.log('[TEST] Przeszedłem do /admin');
    } catch (error: any) {
      // Jeśli strona się nie ładuje, sprawdźmy URL
      const currentUrl = page.url();
      console.log(`[TEST] Timeout podczas ładowania strony. Aktualny URL: ${currentUrl}`);
      
      // Jeśli jesteśmy na stronie logowania, to znaczy że brak uprawnień
      if (currentUrl.includes('/auth/login')) {
        console.log('[TEST] ❌ Brak dostępu - przekierowano do logowania (użytkownik nie jest adminem)');
        return false;
      }
      
      return false;
    }
    
    // Sprawdź czy nie zostaliśmy przekierowani do logowania
    const currentUrl = page.url();
    console.log(`[TEST] Aktualny URL po załadowaniu: ${currentUrl}`);
    
    if (currentUrl.includes('/auth/login')) {
      console.log('[TEST] ❌ Brak dostępu - przekierowano do logowania');
      return false;
    }
    
    // Sprawdź czy jesteśmy na stronie admina
    if (!currentUrl.includes('/admin')) {
      console.log(`[TEST] ❌ Nieoczekiwany URL: ${currentUrl}`);
      return false;
    }
    
    // Poczekaj chwilę na załadowanie zawartości
    await page.waitForTimeout(1000);
    
    // Sprawdź czy jest komunikat o braku uprawnień
    const hasError = await page.getByText(/brak uprawnień|unauthorized|access denied|musisz być zalogowany jako administrator/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    if (hasError) {
      const errorText = await page.getByText(/brak uprawnień|unauthorized|access denied|musisz być zalogowany jako administrator/i)
        .first()
        .textContent()
        .catch(() => '');
      console.log(`[TEST] ❌ Brak uprawnień administratora: ${errorText}`);
      return false;
    }
    
    // Sprawdź czy strona admina się załadowała - szukaj elementów dashboardu
    // Dashboard pokazuje statystyki, więc szukamy tekstów związanych z rezerwacjami lub wycieczkami
    const hasAdminContent = await page.getByText(/rezerwacje|wycieczki|sprzedaż|obłożenie/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (hasAdminContent) {
      console.log('[TEST] ✅ Dostęp do panelu admina potwierdzony (dashboard widoczny)');
      return true;
    }
    
    // Sprawdź czy jest tabela (ostatnie rezerwacje)
    const hasTable = await page.getByRole('table').isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTable) {
      console.log('[TEST] ✅ Dostęp do panelu admina potwierdzony (tabela widoczna)');
      return true;
    }
    
    // Sprawdź czy są karty ze statystykami
    const hasCards = await page.getByText(/rezerwacje dziś|łącznie rezerwacji|sprzedaż/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasCards) {
      console.log('[TEST] ✅ Dostęp do panelu admina potwierdzony (karty statystyk widoczne)');
      return true;
    }
    
    console.log('[TEST] ❌ Nie udało się zweryfikować dostępu - brak widocznych elementów panelu');
    return false;
  } catch (error: any) {
    const currentUrl = page.url();
    console.error(`[TEST] ❌ Błąd podczas sprawdzania dostępu admina. URL: ${currentUrl}`, error.message);
    return false;
  }
}
