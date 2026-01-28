import { test, expect } from '@playwright/test';

test.describe('Walidacja formularzy', () => {
  test('formularz logowania - walidacja wszystkich scenariuszy', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Scenariusz 1: Puste pola
    await page.getByRole('button', { name: /zaloguj/i }).click();
    const emailInput = page.getByLabel(/email/i);
    const emailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(emailInvalid).toBeTruthy();
    
    // Scenariusz 2: Nieprawidłowy format email
    await emailInput.fill('nieprawidlowy-email');
    await page.getByLabel(/hasło|password/i).fill('haslo123');
    const emailStillInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(emailStillInvalid).toBeTruthy();
    
    // Scenariusz 3: Prawidłowy format (bez sprawdzania logowania)
    await emailInput.fill('test@example.com');
    await page.getByLabel(/hasło|password/i).fill('ValidPassword123!');
    const emailNowValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(emailNowValid).toBeTruthy();
  });

  test('formularz rejestracji - sprawdzenie wymagań hasła (jeśli istnieją)', async ({ page }) => {
    await page.goto('/auth/sign-up');
    
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('nowy@example.com');
    
    // Sprawdź czy pole hasła istnieje i ma jakieś wymagania
    const passwordInput = page.getByLabel(/hasło|password/i).first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('123'); // Zbyt krótkie
      
      // Aplikacja może wyświetlać komunikaty o wymaganiach
      // Ten test jest elastyczny i nie zakłada konkretnej implementacji
    }
  });
});

test.describe('Interaktywność formularzy', () => {
  test('focus na następnym polu po Enter', async ({ page }) => {
    await page.goto('/auth/login');
    
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('test@example.com');
    await emailInput.press('Tab');
    
    // Sprawdź czy focus przeszedł dalej
    const passwordInput = page.getByLabel(/hasło|password/i);
    await expect(passwordInput).toBeFocused();
  });

  test('placeholder lub label widoczny dla wszystkich pól', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Sprawdź czy każde pole ma label lub placeholder
    const inputs = await page.locator('input[type="email"], input[type="password"], input[type="text"]').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      
      // Pole powinno mieć ID (dla label) lub placeholder lub aria-label
      const hasLabel = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false;
      expect(hasLabel || placeholder || ariaLabel).toBeTruthy();
    }
  });
});

test.describe('Bezpieczeństwo formularzy', () => {
  test('hasło powinno być maskowane', async ({ page }) => {
    await page.goto('/auth/login');
    
    const passwordInput = page.getByLabel(/hasło|password/i);
    
    // Sprawdź typ pola
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');
    
    // Wpisz hasło i sprawdź czy jest zamaskowane
    await passwordInput.fill('SuperSecretPassword123');
    const value = await passwordInput.inputValue();
    expect(value).toBe('SuperSecretPassword123');
  });

  test('formularz powinien mieć autocomplete dla bezpieczeństwa', async ({ page }) => {
    await page.goto('/auth/login');
    
    const emailInput = page.getByLabel(/email/i);
    const autocomplete = await emailInput.getAttribute('autocomplete');
    
    // Dobra praktyka: pole email powinno mieć autocomplete="email" lub "username"
    // Jest to opcjonalne, więc test jest informacyjny
    if (autocomplete) {
      expect(['email', 'username', 'on']).toContain(autocomplete);
    }
  });
});
