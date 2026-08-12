import { test, expect } from '@playwright/test';

test.describe('Integracja - Flow użytkownika niezalogowanego', () => {
  test('pełny flow: strona główna → wycieczki → powrót', async ({ page }) => {
    // 1. Start na stronie głównej
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    
    // 2. Przejście do wycieczek
    await page.goto('/trip');
    await expect(page).toHaveURL('/trip');
    
    // 3. Powrót do strony głównej (poprzez nawigację przeglądarki)
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('pełny flow: strona główna → logowanie → rejestracja', async ({ page }) => {
    // 1. Start na stronie głównej
    await page.goto('/');
    
    // 2. Jeśli jest link do rejestracji, kliknij go
    const signUpLink = page.getByRole('link', { name: /rejestracja|zarejestruj|sign up/i });
    
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await expect(page).toHaveURL(/sign-up/);
      
      // 3. Powrót do logowania
      const loginLink = page.getByRole('link', { name: /logowanie|zaloguj|login/i });
      if (await loginLink.isVisible()) {
        await loginLink.click();
        await expect(page).toHaveURL(/login/);
      }
    }
  });
});

test.describe('Integracja - Multiple tabs', () => {
  test('otwarcie /trip w nowej karcie', async ({ page, context }) => {
    await page.goto('/');
    
    const newPage = await context.newPage();
    await newPage.goto('/trip');
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('/trip');
    
    await newPage.close();
  });
});

test.describe('Integracja - Historia przeglądarki', () => {
  test('nawigacja wstecz i do przodu powinna działać', async ({ page }) => {
    // Odwiedź kilka stron
    await page.goto('/');
    await page.goto('/trip');
    await page.goto('/auth/login');
    
    // Wstecz
    await page.goBack();
    await expect(page).toHaveURL('/trip');
    
    // Wstecz ponownie
    await page.goBack();
    await expect(page).toHaveURL('/');
    
    // Do przodu
    await page.goForward();
    await expect(page).toHaveURL('/trip');
  });
});

test.describe('Integracja - Resize okna', () => {
  test('aplikacja powinna reagować na zmianę rozmiaru okna', async ({ page }) => {
    await page.goto('/');
    
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
  });
});
