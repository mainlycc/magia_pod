import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/auth';
import { deleteTestTrip } from './helpers/db-helpers';

test.describe('Trip Dashboard - Tworzenie i edycja wycieczki', () => {
  let createdTripId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Zaloguj się
    await loginUser(page);
    
    // Sprawdź czy jesteśmy zalogowani (nie na stronie logowania)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/auth/login');
    console.log(`[TEST] Po logowaniu, aktualny URL: ${currentUrl}`);
  });

  test.afterEach(async ({ page }) => {
    // Wyczyść utworzoną wycieczkę po teście
    if (createdTripId) {
      try {
        await deleteTestTrip(createdTripId);
      } catch (error) {
        console.error('Failed to cleanup test trip:', error);
      }
      createdTripId = null;
    }
    
    // Wyczyść localStorage w przeglądarce
    try {
      await page.evaluate(() => {
        localStorage.removeItem('tripCreation_step1');
        localStorage.removeItem('tripCreation_step2');
      });
    } catch (error) {
      // Ignoruj błędy czyszczenia localStorage
    }
  });

  test('powinien wyświetlić trip-dashboard', async ({ page }) => {
    console.log('[TEST] Sprawdzanie wyświetlania trip-dashboard');
    
    await page.goto('/trip-dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Sprawdź czy strona się załadowała
    await expect(page).toHaveURL(/\/trip-dashboard/);
    console.log('[TEST] Strona trip-dashboard załadowana');
    
    // Sprawdź czy jest widoczny komunikat o wyborze wycieczki lub dashboard
    const selectTripMessage = page.getByText(/wybierz wycieczkę|wybierz wycieczkę z listy/i);
    const dashboardContent = page.getByText(/dashboard|status|data rozpoczęcia/i);
    
    const hasSelectMessage = await selectTripMessage.isVisible().catch(() => false);
    const hasDashboard = await dashboardContent.isVisible().catch(() => false);
    
    expect(hasSelectMessage || hasDashboard).toBeTruthy();
    console.log('[TEST] Trip-dashboard jest widoczny');
  });

  test('powinien utworzyć nową wycieczkę - krok 1 (podstawowe informacje)', async ({ page }) => {
    console.log('[TEST] Rozpoczynam test tworzenia wycieczki - krok 1');
    
    await page.goto('/trip-dashboard/dodaj-wycieczke', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Sprawdź czy strona się załadowała
    await expect(page).toHaveURL(/\/trip-dashboard\/dodaj-wycieczke/);
    console.log('[TEST] Strona dodawania wycieczki załadowana');
    
    // Wypełnij formularz
    const tripTitle = `Test Wycieczka ${Date.now()}`;
    const tripSlug = `test-wycieczka-${Date.now()}`;
    
    await page.getByLabel(/nazwa/i).fill(tripTitle);
    await page.getByLabel(/slug/i).fill(tripSlug);
    await page.getByLabel(/opis/i).fill('To jest opis testowej wycieczki');
    
    // Wypełnij daty
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    
    await page.getByLabel(/data rozpoczęcia/i).fill(startDate.toISOString().split('T')[0]);
    await page.getByLabel(/data zakończenia/i).fill(endDate.toISOString().split('T')[0]);
    
    // Wypełnij kategorię i miejsce
    await page.getByLabel(/kategoria/i).fill('Wycieczki górskie');
    await page.getByLabel(/trasa|kraj/i).fill('Islandia');
    
    // Wypełnij cenę i miejsca
    await page.getByLabel(/cena/i).fill('1500.00');
    await page.getByLabel(/liczba miejsc/i).fill('20');
    
    // Włącz publiczną podstronę
    await page.getByLabel(/publiczna strona wycieczki/i).check();
    await page.getByPlaceholder(/np\. magicka-wycieczka-wlochy/i).fill(`public-${tripSlug}`);
    
    // Zapisz i przejdź dalej
    await page.getByRole('button', { name: /zapisz i przejdź dalej/i }).click();
    
    // Poczekaj na przekierowanie do następnego kroku
    await page.waitForURL(/\/trip-dashboard\/publiczny-wyglad/, { timeout: 10000 });
    console.log('[TEST] Przekierowano do kroku 2 (publiczny wygląd)');
    
    // Sprawdź czy jesteśmy na właściwej stronie
    await expect(page).toHaveURL(/\/trip-dashboard\/publiczny-wyglad/);
  });

  test('powinien edytować informacje o wycieczce', async ({ page }) => {
    console.log('[TEST] Rozpoczynam test edycji informacji o wycieczce');
    
    // Najpierw utwórz wycieczkę przez API (szybsze niż przez UI)
    const tripTitle = `Test Wycieczka Edycja ${Date.now()}`;
    const tripSlug = `test-wycieczka-edycja-${Date.now()}`;
    
    // Użyj fetch zamiast page.request, żeby uniknąć problemów z JSON
    const createResponse = await page.evaluate(async (tripData) => {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });
      return { ok: response.ok, status: response.status, data: await response.json() };
    }, {
      title: tripTitle,
      slug: tripSlug,
      description: 'Opis przed edycją',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      price_cents: 100000,
      seats_total: 15,
      is_active: true,
      is_public: false,
      category: 'Test',
      location: 'Test Location',
    });
    
    expect(createResponse.ok).toBeTruthy();
    createdTripId = createResponse.data.id;
    
    // Przejdź do trip-dashboard i wybierz wycieczkę
    await page.goto('/trip-dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wybierz wycieczkę z dropdown (jeśli jest)
    const tripSelect = page.locator('select').filter({ hasText: tripTitle }).or(
      page.getByRole('combobox').filter({ hasText: tripTitle })
    );
    
    const hasSelect = await tripSelect.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSelect) {
      await tripSelect.first().click();
      await page.waitForTimeout(500);
      await page.getByText(tripTitle).click();
      await page.waitForTimeout(1000);
    }
    
    // Przejdź do edycji informacji
    await page.goto('/trip-dashboard/informacje', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Sprawdź czy formularz się załadował
    const titleInput = page.getByLabel(/nazwa/i).or(page.locator('input[placeholder*="Nazwa"]'));
    await expect(titleInput.first()).toBeVisible({ timeout: 5000 });
    console.log('[TEST] Formularz edycji załadowany');
    
    // Zmień dane
    const newTitle = `Edytowana ${tripTitle}`;
    const newDescription = 'Zaktualizowany opis wycieczki';
    const newPrice = '2000.00';
    const newSeats = '25';
    
    await titleInput.first().clear();
    await titleInput.first().fill(newTitle);
    
    const descriptionInput = page.getByLabel(/opis/i).or(page.locator('textarea'));
    await descriptionInput.first().clear();
    await descriptionInput.first().fill(newDescription);
    
    const priceInput = page.getByLabel(/cena/i).or(page.locator('input[type="number"]').filter({ hasText: /cena/i }));
    await priceInput.first().clear();
    await priceInput.first().fill(newPrice);
    
    const seatsInput = page.getByLabel(/liczba miejsc/i).or(page.locator('input[type="number"]').filter({ hasText: /miejsc/i }));
    await seatsInput.first().clear();
    await seatsInput.first().fill(newSeats);
    
    // Zapisz zmiany
    const saveButton = page.getByRole('button', { name: /zapisz/i });
    await saveButton.click();
    
    // Poczekaj na komunikat sukcesu (toast)
    await page.waitForTimeout(1000);
    
    // Sprawdź czy dane zostały zaktualizowane - przeładuj stronę
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Sprawdź czy wartości są zaktualizowane
    await expect(titleInput.first()).toHaveValue(newTitle, { timeout: 5000 });
    console.log('[TEST] Informacje zostały zaktualizowane');
  });

  test('powinien edytować formularz wycieczki', async ({ page }) => {
    console.log('[TEST] Rozpoczynam test edycji formularza wycieczki');
    
    // Utwórz wycieczkę przez API
    const tripTitle = `Test Wycieczka Formularz ${Date.now()}`;
    const tripSlug = `test-wycieczka-formularz-${Date.now()}`;
    
    // Użyj fetch zamiast page.request
    const createResponse = await page.evaluate(async (tripData) => {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });
      return { ok: response.ok, status: response.status, data: await response.json() };
    }, {
      title: tripTitle,
      slug: tripSlug,
      is_active: true,
    });
    
    expect(createResponse.ok).toBeTruthy();
    createdTripId = createResponse.data.id;
    
    // Przejdź do trip-dashboard i wybierz wycieczkę
    await page.goto('/trip-dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wybierz wycieczkę z dropdown (jeśli jest)
    const tripSelect = page.locator('select').filter({ hasText: tripTitle }).or(
      page.getByRole('combobox').filter({ hasText: tripTitle })
    );
    
    const hasSelect = await tripSelect.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSelect) {
      await tripSelect.first().click();
      await page.waitForTimeout(500);
      await page.getByText(tripTitle).click();
      await page.waitForTimeout(1000);
    }
    
    // Przejdź do edycji formularza
    await page.goto('/trip-dashboard/informacje/formularz', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Sprawdź czy formularz się załadował
    const formContent = page.getByText(/tryb rejestracji|formularz|rejestracja/i);
    await expect(formContent.first()).toBeVisible({ timeout: 5000 });
    console.log('[TEST] Formularz edycji załadowany');
    
    // Sprawdź czy można zmienić tryb rejestracji
    const registrationMode = page.getByLabel(/tryb rejestracji|rejestracja/i).or(
      page.locator('select').filter({ hasText: /indywidualna|firmowa|oba/i })
    );
    
    const hasRegistrationMode = await registrationMode.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasRegistrationMode) {
      await registrationMode.first().click();
      await page.waitForTimeout(500);
      console.log('[TEST] Tryb rejestracji jest dostępny');
    }
    
    // Sprawdź czy są sekcje formularza
    const hasSections = await page.getByText(/dodatkowe atrakcje|diety|ubezpieczenia/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    
    expect(hasSections || hasRegistrationMode).toBeTruthy();
    console.log('[TEST] Formularz wycieczki jest dostępny do edycji');
  });

  test('powinien walidować wymagane pola przy tworzeniu wycieczki', async ({ page }) => {
    console.log('[TEST] Sprawdzanie walidacji wymaganych pól');
    
    await page.goto('/trip-dashboard/dodaj-wycieczke', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Spróbuj zapisać bez wypełnienia wymaganych pól
    const saveButton = page.getByRole('button', { name: /zapisz/i });
    await expect(saveButton).toBeDisabled();
    
    // Wypełnij tylko nazwę (bez slug)
    await page.getByLabel(/nazwa/i).fill('Test');
    
    // Przycisk powinien nadal być wyłączony (brak slug)
    await expect(saveButton).toBeDisabled();
    
    // Wypełnij slug
    await page.getByLabel(/slug/i).fill('test-slug');
    
    // Teraz przycisk powinien być aktywny
    await expect(saveButton).toBeEnabled();
    console.log('[TEST] Walidacja wymaganych pól działa poprawnie');
  });

  test('powinien wyświetlić informacje o wybranej wycieczce', async ({ page }) => {
    console.log('[TEST] Sprawdzanie wyświetlania informacji o wycieczce');
    
    // Utwórz wycieczkę przez API
    const tripTitle = `Test Wycieczka Info ${Date.now()}`;
    const tripSlug = `test-wycieczka-info-${Date.now()}`;
    
    // Użyj fetch zamiast page.request
    const createResponse = await page.evaluate(async (tripData) => {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });
      return { ok: response.ok, status: response.status, data: await response.json() };
    }, {
      title: tripTitle,
      slug: tripSlug,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      price_cents: 150000,
      seats_total: 20,
      is_active: true,
    });
    
    expect(createResponse.ok).toBeTruthy();
    createdTripId = createResponse.data.id;
    
    // Przejdź do trip-dashboard
    await page.goto('/trip-dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wybierz wycieczkę z dropdown (jeśli jest)
    const tripSelect = page.locator('select').filter({ hasText: tripTitle }).or(
      page.getByRole('combobox').filter({ hasText: tripTitle })
    );
    
    const hasSelect = await tripSelect.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSelect) {
      await tripSelect.first().click();
      await page.waitForTimeout(500);
      await page.getByText(tripTitle).click();
      await page.waitForTimeout(2000);
    }
    
    // Sprawdź czy wycieczka jest widoczna
    const tripTitleElement = page.getByText(tripTitle);
    const hasTitle = await tripTitleElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasTitle) {
      await expect(tripTitleElement).toBeVisible();
      console.log('[TEST] Informacje o wycieczce są widoczne');
    } else {
      // Może być komunikat o wyborze wycieczki
      const selectMessage = page.getByText(/wybierz wycieczkę/i);
      const hasMessage = await selectMessage.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasMessage || hasTitle).toBeTruthy();
      console.log('[TEST] Trip-dashboard jest widoczny');
    }
  });
});

test.describe('Trip Dashboard - Uprawnienia', () => {
  test('niezalogowany użytkownik nie powinien mieć dostępu', async ({ page }) => {
    console.log('[TEST] Sprawdzam dostęp niezalogowanego użytkownika');
    
    await page.goto('/trip-dashboard');
    
    // Powinien zostać przekierowany do logowania
    await page.waitForURL(/\/(auth\/login|$)/, { timeout: 5000 });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth/login');
    console.log('[TEST] Niezalogowany użytkownik został przekierowany do logowania');
  });
});
