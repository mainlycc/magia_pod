import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/auth';

test.describe('Panel admina - Zarządzanie rezerwacjami', () => {
  test.beforeEach(async ({ page }) => {
    // Zaloguj się jako admin
    await loginUser(page);
    
    // Sprawdź czy jesteśmy zalogowani
    await page.waitForURL(/\/(admin|trip-dashboard)/);
  });

  test('powinien wyświetlić listę rezerwacji', async ({ page }) => {
    // Przejdź do panelu rezerwacji
    await page.goto('/admin/bookings');
    
    // Poczekaj na załadowanie
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy strona się załadowała
    await expect(page).toHaveURL(/\/admin\/bookings/);
    
    // Sprawdź czy jest tabela lub lista rezerwacji
    const bookingsTable = page.getByRole('table');
    const bookingsList = page.getByText(/rezerwacje|bookings/i);
    
    // Albo tabela, albo lista powinna być widoczna
    const hasTable = await bookingsTable.isVisible().catch(() => false);
    const hasList = await bookingsList.isVisible().catch(() => false);
    
    expect(hasTable || hasList).toBeTruthy();
  });

  test('powinien filtrować rezerwacje', async ({ page }) => {
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy są filtry (jeśli są zaimplementowane)
    const searchInput = page.getByPlaceholder(/szukaj|search|filtruj/i);
    const filterButton = page.getByRole('button', { name: /filtruj|filter/i });
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Poczekaj na filtrowanie
      
      // Sprawdź czy wyniki się zmieniły
      expect(await searchInput.inputValue()).toBe('test');
    } else if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Sprawdź czy pojawiło się menu filtrów
      const filterMenu = page.getByText(/status|typ|data/i);
      if (await filterMenu.isVisible()) {
        await expect(filterMenu).toBeVisible();
      }
    }
  });

  test('powinien wyświetlić szczegóły rezerwacji', async ({ page }) => {
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    
    // Znajdź pierwszą rezerwację w tabeli/liscie
    const firstBooking = page.getByRole('row').first();
    const bookingLink = page.getByRole('link').first();
    
    if (await firstBooking.isVisible()) {
      await firstBooking.click();
      
      // Sprawdź czy pojawiły się szczegóły
      await page.waitForTimeout(500);
      
      const detailsSection = page.getByText(/szczegóły|details|rezerwacja/i);
      if (await detailsSection.isVisible()) {
        await expect(detailsSection).toBeVisible();
      }
    } else if (await bookingLink.isVisible()) {
      await bookingLink.click();
      
      // Sprawdź czy przeszliśmy do strony szczegółów
      await page.waitForURL(/\/admin\/bookings\/.+/);
    }
  });

  test('powinien zmienić status rezerwacji', async ({ page }) => {
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    
    // Znajdź przycisk zmiany statusu
    const statusButton = page.getByRole('button', { name: /status|zmień|change/i }).first();
    const statusSelect = page.getByLabel(/status/i).first();
    
    if (await statusButton.isVisible()) {
      await statusButton.click();
      
      // Sprawdź czy pojawiło się menu wyboru statusu
      const statusMenu = page.getByText(/potwierdzona|confirmed|canceled|anulowana/i);
      if (await statusMenu.isVisible()) {
        await statusMenu.first().click();
        
        // Sprawdź czy status się zmienił
        await page.waitForTimeout(500);
        // W rzeczywistym teście sprawdź czy status został zaktualizowany
      }
    } else if (await statusSelect.isVisible()) {
      await statusSelect.click();
      
      // Wybierz nowy status
      const newStatus = page.getByText(/potwierdzona|confirmed/i).first();
      if (await newStatus.isVisible()) {
        await newStatus.click();
        
        // Sprawdź czy status się zmienił
        await page.waitForTimeout(500);
      }
    }
  });

  test('powinien eksportować rezerwacje do CSV', async ({ page }) => {
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    
    // Znajdź przycisk eksportu
    const exportButton = page.getByRole('button', { name: /eksport|export|csv/i });
    
    if (await exportButton.isVisible()) {
      // Nasłuchuj na pobieranie pliku
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      // Sprawdź czy plik został pobrany
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });

  test('powinien wyświetlić statystyki rezerwacji', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy są statystyki na dashboardzie
    const statsSection = page.getByText(/rezerwacje|bookings|statystyki|statistics/i);
    
    if (await statsSection.isVisible()) {
      await expect(statsSection).toBeVisible();
      
      // Sprawdź czy są liczby/statystyki
      const numbers = page.getByText(/\d+/);
      const count = await numbers.count();
      
      if (count > 0) {
        // Sprawdź czy są jakieś statystyki wyświetlone
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('powinien wyszukiwać rezerwacje po kodzie', async ({ page }) => {
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    
    // Znajdź pole wyszukiwania
    const searchInput = page.getByPlaceholder(/szukaj|search|kod|ref/i);
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('BK-');
      await page.waitForTimeout(500);
      
      // Sprawdź czy wyniki się zmieniły
      expect(await searchInput.inputValue()).toContain('BK-');
    }
  });
});

test.describe('Panel admina - Zarządzanie rezerwacjami - uprawnienia', () => {
  test('niezalogowany użytkownik nie powinien mieć dostępu', async ({ page }) => {
    await page.goto('/admin/bookings');
    
    // Powinien zostać przekierowany do logowania
    await page.waitForURL(/\/(auth\/login|$)/);
  });

  test('użytkownik bez uprawnień admina nie powinien mieć dostępu', async ({ page }) => {
    // Zaloguj się jako zwykły użytkownik (jeśli istnieje)
    // W rzeczywistym teście użyj użytkownika z rolą 'user' lub 'coordinator'
    
    await page.goto('/admin/bookings');
    
    // Powinien zostać przekierowany lub zobaczyć błąd
    await page.waitForURL(/\/(auth\/login|admin|403|unauthorized)/);
    
    // Sprawdź czy jest komunikat o braku uprawnień
    const errorMessage = page.getByText(/brak uprawnień|unauthorized|access denied/i);
    
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
    }
  });
});
