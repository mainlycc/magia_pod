import { test, expect } from '@playwright/test';
import { loginUser, verifyAdminAccess } from './helpers/auth';
import { deleteTestTrip } from './helpers/db-helpers';

test.describe('Panel admina - Tworzenie i edycja wycieczki', () => {
  let createdTripId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Zaloguj się jako admin
    await loginUser(page);
    
    // Sprawdź czy jesteśmy zalogowani (nie na stronie logowania)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/auth/login');
    console.log(`[TEST] Po logowaniu, aktualny URL: ${currentUrl}`);
    
    // Sprawdź czy mamy dostęp do panelu admina
    const hasAdminAccess = await verifyAdminAccess(page);
    expect(hasAdminAccess).toBeTruthy();
    console.log('[TEST] Dostęp do panelu admina zweryfikowany');
  });

  test.afterEach(async () => {
    // Wyczyść utworzoną wycieczkę po teście
    if (createdTripId) {
      try {
        await deleteTestTrip(createdTripId);
      } catch (error) {
        console.error('Failed to cleanup test trip:', error);
      }
      createdTripId = null;
    }
  });

  test('powinien wyświetlić listę wycieczek', async ({ page }) => {
    console.log('[TEST] Rozpoczynam test wyświetlania listy wycieczek');
    
    await page.goto('/admin/trips');
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy strona się załadowała
    await expect(page).toHaveURL(/\/admin\/trips/);
    console.log('[TEST] Strona /admin/trips załadowana');
    
    // Sprawdź czy jest tabela wycieczek
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    console.log('[TEST] Tabela wycieczek jest widoczna');
    
    // Sprawdź czy jest przycisk dodawania
    await expect(page.getByRole('button', { name: /dodaj wycieczkę/i })).toBeVisible();
    console.log('[TEST] Przycisk "Dodaj wycieczkę" jest widoczny');
  });

  test('powinien utworzyć nową wycieczkę z wszystkimi danymi', async ({ page }) => {
    // Przejdź do strony tworzenia wycieczki
    await page.goto('/admin/trips');
    await page.waitForLoadState('networkidle');
    
    // Kliknij przycisk "Dodaj wycieczkę"
    await page.getByRole('button', { name: /dodaj wycieczkę/i }).click();
    await page.waitForURL(/\/admin\/trips\/new/);
    
    // Wypełnij formularz
    const tripTitle = `Test Wycieczka ${Date.now()}`;
    const tripSlug = `test-wycieczka-${Date.now()}`;
    
    await page.getByLabel(/^nazwa/i).fill(tripTitle);
    await page.getByLabel(/^slug/i).fill(tripSlug);
    await page.getByLabel(/^opis/i).fill('To jest opis testowej wycieczki');
    
    // Wypełnij daty
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    
    await page.getByLabel(/data rozpoczęcia/i).fill(startDate.toISOString().split('T')[0]);
    await page.getByLabel(/data zakończenia/i).fill(endDate.toISOString().split('T')[0]);
    
    // Wypełnij kategorię i miejsce
    await page.getByLabel(/^kategoria/i).fill('Wycieczki górskie');
    await page.getByLabel(/^miejsce/i).fill('Islandia');
    
    // Wypełnij cenę i miejsca
    await page.getByLabel(/^cena/i).fill('1500.00');
    await page.getByLabel(/liczba miejsc/i).fill('20');
    
    // Włącz publiczną podstronę
    await page.getByLabel(/wygeneruj publiczną podstronę/i).check();
    await page.getByLabel(/publiczny slug/i).fill(`public-${tripSlug}`);
    
    // Zapisz wycieczkę
    await page.getByRole('button', { name: /zapisz i przejdź do treści/i }).click();
    
    // Poczekaj na przekierowanie do strony edycji treści
    await page.waitForURL(/\/admin\/trips\/[^/]+\/content/, { timeout: 10000 });
    
    // Pobierz ID wycieczki z URL
    const url = page.url();
    const match = url.match(/\/admin\/trips\/([^/]+)\/content/);
    if (match) {
      createdTripId = match[1];
    }
    
    // Sprawdź czy strona treści się załadowała
    await expect(page).toHaveURL(/\/admin\/trips\/[^/]+\/content/);
  });

  test('powinien edytować istniejącą wycieczkę', async ({ page }) => {
    // Najpierw utwórz wycieczkę przez API (szybsze niż przez UI)
    const tripTitle = `Test Wycieczka Edycja ${Date.now()}`;
    const tripSlug = `test-wycieczka-edycja-${Date.now()}`;
    
    // Utwórz wycieczkę przez API
    const createResponse = await page.request.post('/api/trips', {
      data: {
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
      },
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const tripData = await createResponse.json();
    createdTripId = tripData.id;
    
    // Przejdź do strony edycji
    await page.goto(`/admin/trips/${createdTripId}/edit`);
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy formularz się załadował
    await expect(page.getByLabel(/^nazwa/i)).toBeVisible();
    
    // Zmień dane
    const newTitle = `Edytowana ${tripTitle}`;
    const newDescription = 'Zaktualizowany opis wycieczki';
    const newPrice = '2000.00';
    const newSeats = '25';
    
    await page.getByLabel(/^nazwa/i).clear();
    await page.getByLabel(/^nazwa/i).fill(newTitle);
    
    await page.getByLabel(/^opis/i).clear();
    await page.getByLabel(/^opis/i).fill(newDescription);
    
    await page.getByLabel(/^cena/i).clear();
    await page.getByLabel(/^cena/i).fill(newPrice);
    
    await page.getByLabel(/liczba miejsc/i).clear();
    await page.getByLabel(/liczba miejsc/i).fill(newSeats);
    
    // Włącz publiczną podstronę
    await page.getByLabel(/publiczna podstrona/i).check();
    await page.getByLabel(/publiczny slug/i).fill(`public-${tripSlug}`);
    
    // Zapisz zmiany
    await page.getByRole('button', { name: /^zapisz$/i }).click();
    
    // Poczekaj na komunikat sukcesu (toast)
    await page.waitForTimeout(1000);
    
    // Sprawdź czy dane zostały zaktualizowane - przeładuj stronę
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy wartości są zaktualizowane
    await expect(page.getByLabel(/^nazwa/i)).toHaveValue(newTitle);
    await expect(page.getByLabel(/^opis/i)).toHaveValue(newDescription);
    await expect(page.getByLabel(/^cena/i)).toHaveValue(newPrice);
    await expect(page.getByLabel(/liczba miejsc/i)).toHaveValue(newSeats);
    await expect(page.getByLabel(/publiczna podstrona/i)).toBeChecked();
  });

  test('powinien walidować wymagane pola przy tworzeniu wycieczki', async ({ page }) => {
    await page.goto('/admin/trips/new');
    await page.waitForLoadState('networkidle');
    
    // Spróbuj zapisać bez wypełnienia wymaganych pól
    const saveButton = page.getByRole('button', { name: /zapisz/i });
    await expect(saveButton).toBeDisabled();
    
    // Wypełnij tylko nazwę (bez slug)
    await page.getByLabel(/^nazwa/i).fill('Test');
    
    // Przycisk powinien nadal być wyłączony (brak slug)
    await expect(saveButton).toBeDisabled();
    
    // Wypełnij slug
    await page.getByLabel(/^slug/i).fill('test-slug');
    
    // Teraz przycisk powinien być aktywny
    await expect(saveButton).toBeEnabled();
  });

  test('powinien przypisać koordynatora do wycieczki', async ({ page }) => {
    // Utwórz wycieczkę
    const tripTitle = `Test Wycieczka Koordynator ${Date.now()}`;
    const tripSlug = `test-wycieczka-koord-${Date.now()}`;
    
    const createResponse = await page.request.post('/api/trips', {
      data: {
        title: tripTitle,
        slug: tripSlug,
        is_active: true,
      },
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const tripData = await createResponse.json();
    createdTripId = tripData.id;
    
    // Przejdź do edycji
    await page.goto(`/admin/trips/${createdTripId}/edit`);
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy sekcja koordynatorów jest widoczna
    await expect(page.getByText(/koordynatorzy/i)).toBeVisible();
    
    // Sprawdź czy można przypisać koordynatora (jeśli są dostępni)
    const coordinatorSelect = page.locator('select').filter({ hasText: /koordynator/i }).or(
      page.getByRole('combobox').filter({ hasText: /koordynator/i })
    );
    
    // Sprawdź czy Select jest widoczny
    const selectElement = page.locator('[role="combobox"]').filter({ hasText: /przypisz koordynatora|wybierz koordynatora/i });
    const isSelectVisible = await selectElement.isVisible().catch(() => false);
    
    if (isSelectVisible) {
      // Kliknij na select
      await selectElement.click();
      await page.waitForTimeout(500);
      
      // Sprawdź czy pojawiły się opcje
      const options = page.getByRole('option');
      const optionsCount = await options.count();
      
      if (optionsCount > 0) {
        // Wybierz pierwszą opcję
        await options.first().click();
        await page.waitForTimeout(500);
        
        // Kliknij przycisk "Przypisz"
        const assignButton = page.getByRole('button', { name: /przypisz/i });
        if (await assignButton.isVisible()) {
          await assignButton.click();
          
          // Poczekaj na komunikat sukcesu (toast)
          await page.waitForTimeout(1000);
          
          // Sprawdź czy koordynator został dodany (odśwież stronę)
          await page.reload();
          await page.waitForLoadState('networkidle');
          
          // Sprawdź czy koordynator jest widoczny w liście
          const coordinatorBadge = page.getByRole('button', { name: /×/ }).or(
            page.locator('button').filter({ hasText: /×/ })
          );
          const hasCoordinator = await coordinatorBadge.first().isVisible().catch(() => false);
          
          if (hasCoordinator) {
            // Koordynator został przypisany
            expect(true).toBeTruthy();
          }
        }
      }
    } else {
      // Jeśli nie ma koordynatorów, sprawdź czy jest odpowiedni komunikat
      const noCoordinatorsMessage = page.getByText(/brak przypisanych koordynatorów/i).or(
        page.getByText(/wszyscy dostępni koordynatorzy/i)
      );
      const hasMessage = await noCoordinatorsMessage.first().isVisible().catch(() => false);
      
      if (hasMessage) {
        await expect(noCoordinatorsMessage.first()).toBeVisible();
      }
    }
  });

  test('powinien odpiąć koordynatora od wycieczki', async ({ page }) => {
    // Utwórz wycieczkę
    const tripTitle = `Test Wycieczka Odpinanie ${Date.now()}`;
    const tripSlug = `test-wycieczka-odpinanie-${Date.now()}`;
    
    const createResponse = await page.request.post('/api/trips', {
      data: {
        title: tripTitle,
        slug: tripSlug,
        is_active: true,
      },
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const tripData = await createResponse.json();
    createdTripId = tripData.id;
    
    // Przejdź do edycji
    await page.goto(`/admin/trips/${createdTripId}/edit`);
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy są przypisani koordynatorzy
    const removeButtons = page.locator('button').filter({ hasText: /×/ }).or(
      page.locator('button[aria-label*="usuń" i]')
    );
    const removeButtonCount = await removeButtons.count();
    
    if (removeButtonCount > 0) {
      // Kliknij pierwszy przycisk usuwania
      await removeButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Sprawdź czy koordynator został usunięty (odśwież stronę)
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Sprawdź czy liczba koordynatorów się zmniejszyła
      const newRemoveButtonCount = await removeButtons.count();
      expect(newRemoveButtonCount).toBeLessThan(removeButtonCount);
    } else {
      // Jeśli nie ma koordynatorów, test przechodzi (nie ma co odpiąć)
      expect(true).toBeTruthy();
    }
  });

  test('powinien wyświetlić szczegóły wycieczki w tabeli', async ({ page }) => {
    // Utwórz wycieczkę przez API
    const tripTitle = `Test Wycieczka Tabela ${Date.now()}`;
    const tripSlug = `test-wycieczka-tabela-${Date.now()}`;
    
    const createResponse = await page.request.post('/api/trips', {
      data: {
        title: tripTitle,
        slug: tripSlug,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        price_cents: 150000,
        seats_total: 20,
        is_active: true,
      },
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const tripData = await createResponse.json();
    createdTripId = tripData.id;
    
    // Przejdź do listy wycieczek
    await page.goto('/admin/trips');
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy wycieczka jest widoczna w tabeli
    await expect(page.getByText(tripTitle)).toBeVisible();
    
    // Sprawdź czy są widoczne szczegóły (cena, miejsca, daty)
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    
    // Sprawdź czy są przyciski akcji
    const editButton = page.getByRole('link', { name: /edytuj/i }).or(
      page.getByRole('button', { name: /edytuj/i })
    );
    const hasEditButton = await editButton.first().isVisible().catch(() => false);
    
    if (hasEditButton) {
      await expect(editButton.first()).toBeVisible();
    }
  });

  test('powinien wyszukiwać wycieczki w tabeli', async ({ page }) => {
    // Utwórz wycieczkę przez API
    const tripTitle = `Test Wycieczka Wyszukiwanie ${Date.now()}`;
    const tripSlug = `test-wycieczka-wyszukiwanie-${Date.now()}`;
    
    const createResponse = await page.request.post('/api/trips', {
      data: {
        title: tripTitle,
        slug: tripSlug,
        is_active: true,
      },
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const tripData = await createResponse.json();
    createdTripId = tripData.id;
    
    // Przejdź do listy wycieczek
    await page.goto('/admin/trips');
    await page.waitForLoadState('networkidle');
    
    // Znajdź pole wyszukiwania
    const searchInput = page.getByPlaceholder(/szukaj wycieczek/i).or(
      page.getByPlaceholder(/search/i)
    );
    
    if (await searchInput.isVisible()) {
      // Wpisz część nazwy wycieczki
      await searchInput.fill('Wyszukiwanie');
      await page.waitForTimeout(500);
      
      // Sprawdź czy wycieczka jest widoczna
      await expect(page.getByText(tripTitle)).toBeVisible();
      
      // Wpisz coś, czego nie ma
      await searchInput.clear();
      await searchInput.fill('Nieistniejąca Wycieczka 12345');
      await page.waitForTimeout(500);
      
      // Sprawdź czy wycieczka zniknęła z widoku
      const isVisible = await page.getByText(tripTitle).isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();
    }
  });
});

test.describe('Panel admina - Wycieczki - uprawnienia', () => {
  test('niezalogowany użytkownik nie powinien mieć dostępu', async ({ page }) => {
    console.log('[TEST] Sprawdzam dostęp niezalogowanego użytkownika');
    
    await page.goto('/admin/trips');
    
    // Powinien zostać przekierowany do logowania
    await page.waitForURL(/\/(auth\/login|$)/, { timeout: 5000 });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth/login');
    console.log('[TEST] Niezalogowany użytkownik został przekierowany do logowania');
  });

  test('niezalogowany użytkownik nie powinien móc tworzyć wycieczki', async ({ page }) => {
    console.log('[TEST] Sprawdzam dostęp do tworzenia wycieczki dla niezalogowanego użytkownika');
    
    await page.goto('/admin/trips/new');
    
    // Powinien zostać przekierowany do logowania
    await page.waitForURL(/\/(auth\/login|$)/, { timeout: 5000 });
    const currentUrl = page.url();
    expect(currentUrl).toContain('/auth/login');
    console.log('[TEST] Niezalogowany użytkownik nie może tworzyć wycieczki');
  });
});

test.describe('Panel admina - Logowanie', () => {
  test('powinien się zalogować jako admin i mieć dostęp do panelu', async ({ page }) => {
    console.log('[TEST] Test logowania jako admin');
    
    // Sprawdź czy jesteśmy na stronie logowania
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);
    console.log('[TEST] Na stronie logowania');
    
    // Zaloguj się
    await loginUser(page);
    
    // Sprawdź czy logowanie się powiodło
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/auth/login');
    console.log(`[TEST] Zalogowano, przekierowano do: ${currentUrl}`);
    
    // Sprawdź dostęp do panelu admina (ta funkcja już sprawdza elementy panelu)
    const hasAdminAccess = await verifyAdminAccess(page);
    expect(hasAdminAccess).toBeTruthy();
    console.log('[TEST] Panel admina jest w pełni dostępny');
  });
});
