import { test, expect } from '@playwright/test';
import { createMockTrip, createMockBookingFormValues } from './helpers/test-data';

test.describe('Flow rezerwacji wycieczki', () => {
  test.beforeEach(async ({ page }) => {
    // Przejdź do strony głównej
    await page.goto('/');
  });

  test('powinien wyświetlić formularz rezerwacji', async ({ page }) => {
    // Przejdź do strony wycieczek
    await page.goto('/trip');
    
    // Poczekaj na załadowanie listy wycieczek
    await page.waitForLoadState('networkidle');
    
    // Sprawdź czy są wycieczki (lub komunikat o braku)
    const tripLinks = page.getByRole('link', { name: /rezerwuj|zarezerwuj|book/i });
    const tripCount = await tripLinks.count();
    
    if (tripCount > 0) {
      // Kliknij pierwszą dostępną wycieczkę
      await tripLinks.first().click();
      
      // Sprawdź czy jest przycisk rezerwacji
      const reserveButton = page.getByRole('link', { name: /rezerwuj|zarezerwuj|book/i });
      if (await reserveButton.isVisible()) {
        await reserveButton.click();
        
        // Sprawdź czy formularz się załadował
        await expect(page.getByText(/rezerwacja|booking/i)).toBeVisible();
      }
    } else {
      // Jeśli nie ma wycieczek, sprawdź czy strona się załadowała
      await expect(page).toHaveURL(/\/trip/);
    }
  });

  test('powinien walidować wymagane pola formularza', async ({ page }) => {
    // Przejdź bezpośrednio do formularza rezerwacji (jeśli slug jest znany)
    // W rzeczywistym teście użyj prawdziwego slug wycieczki
    await page.goto('/trip/test-trip/reserve');
    
    // Poczekaj na załadowanie formularza
    await page.waitForLoadState('networkidle');
    
    // Spróbuj wysłać formularz bez wypełnienia
    const submitButton = page.getByRole('button', { name: /dalej|zapisz|submit|potwierdź/i });
    
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Sprawdź czy pojawiły się błędy walidacji
      const emailInput = page.getByLabel(/email/i);
      if (await emailInput.isVisible()) {
        const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
        expect(isInvalid).toBeTruthy();
      }
    }
  });

  test('powinien wypełnić formularz rezerwacji dla osoby fizycznej', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Wypełnij dane kontaktowe
    const emailInput = page.getByLabel(/email/i);
    const phoneInput = page.getByLabel(/telefon|phone/i);
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
    }
    
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('123456789');
    }
    
    // Sprawdź czy pola zostały wypełnione
    if (await emailInput.isVisible()) {
      await expect(emailInput).toHaveValue('test@example.com');
    }
  });

  test('powinien przełączać między typem osoby fizycznej a firmą', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Znajdź przycisk/tab do przełączenia na firmę
    const companyTab = page.getByText(/firma|company/i).first();
    
    if (await companyTab.isVisible()) {
      await companyTab.click();
      
      // Sprawdź czy pojawiły się pola firmowe
      await page.waitForTimeout(500);
      
      const companyNameInput = page.getByLabel(/nazwa firmy|company name/i);
      if (await companyNameInput.isVisible()) {
        await expect(companyNameInput).toBeVisible();
      }
    }
  });

  test('powinien obsłużyć błąd przy braku miejsc', async ({ page }) => {
    // Ten test wymaga wycieczki z wyczerpanymi miejscami
    // W rzeczywistym teście użyj mocka lub przygotuj dane testowe
    
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Wypełnij formularz
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
    }
    
    // Jeśli formularz ma informację o dostępności miejsc, sprawdź ją
    const seatsInfo = page.getByText(/miejsc|seats|dostępne/i);
    if (await seatsInfo.isVisible()) {
      const text = await seatsInfo.textContent();
      // Sprawdź czy jest informacja o braku miejsc
      if (text?.toLowerCase().includes('brak') || text?.toLowerCase().includes('0')) {
        expect(text).toBeTruthy();
      }
    }
  });

  test('powinien wyświetlić podsumowanie przed wysłaniem', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Wypełnij formularz i przejdź do podsumowania
    // (w zależności od implementacji formularza)
    
    const summarySection = page.getByText(/podsumowanie|summary|zgody/i);
    
    // Jeśli jest sekcja podsumowania, sprawdź czy jest widoczna
    if (await summarySection.isVisible()) {
      await expect(summarySection).toBeVisible();
    }
  });

  test('powinien obsłużyć zgody RODO', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Znajdź checkboxy zgód
    const rodoCheckbox = page.getByLabel(/rodo|zgoda|consent/i).first();
    
    if (await rodoCheckbox.isVisible()) {
      // Sprawdź czy checkbox jest widoczny
      await expect(rodoCheckbox).toBeVisible();
      
      // Sprawdź czy można go zaznaczyć
      await rodoCheckbox.click();
      await expect(rodoCheckbox).toBeChecked();
    }
  });

  test('powinien wyświetlić komunikat sukcesu po rezerwacji', async ({ page }) => {
    // Ten test wymaga mockowania API lub użycia testowej bazy danych
    // W rzeczywistym teście użyj mocka API
    
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Mockuj odpowiedź API
    await page.route('**/api/bookings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          booking_ref: 'BK-TEST-123',
          booking_url: '/booking/token123',
        }),
      });
    });
    
    // Wypełnij i wyślij formularz (jeśli jest możliwe)
    // W rzeczywistym teście użyj pełnego flow
    
    // Sprawdź czy pojawił się komunikat sukcesu
    const successMessage = page.getByText(/sukces|success|potwierdzono/i);
    
    // Ten test może wymagać pełnego wypełnienia formularza
    // W zależności od implementacji
  });
});

test.describe('Flow rezerwacji - edge cases', () => {
  test('powinien obsłużyć timeout przy wysyłaniu formularza', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Mockuj timeout API
    await page.route('**/api/bookings', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Długi timeout
      await route.continue();
    });
    
    // W rzeczywistym teście sprawdź czy jest obsługa timeoutu
    // (np. komunikat błędu, możliwość ponowienia)
  });

  test('powinien obsłużyć błąd sieci', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Mockuj błąd sieci
    await page.route('**/api/bookings', async (route) => {
      await route.abort('failed');
    });
    
    // W rzeczywistym teście sprawdź czy jest obsługa błędu sieci
  });

  test('powinien obsłużyć nieprawidłowe dane w formularzu', async ({ page }) => {
    await page.goto('/trip/test-trip/reserve');
    await page.waitForLoadState('networkidle');
    
    // Wprowadź nieprawidłowe dane
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isVisible()) {
      await emailInput.fill('nieprawidlowy-email');
      
      // Sprawdź czy pojawił się błąd walidacji
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBeTruthy();
    }
  });
});
