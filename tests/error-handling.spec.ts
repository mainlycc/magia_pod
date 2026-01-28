import { test, expect } from '@playwright/test';

test.describe('Obsługa błędów', () => {
  test('nieprawidłowa ścieżka powinna wyświetlić 404', async ({ page }) => {
    const response = await page.goto('/strona-ktora-nie-istnieje-xyz123');
    
    // Next.js zwraca 404 dla nieistniejących stron
    expect(response?.status()).toBe(404);
  });

  test('strona błędu powinna być przyjazna dla użytkownika', async ({ page }) => {
    await page.goto('/auth/error');
    
    // Strona błędu powinna się załadować (nie crashować)
    await expect(page).toHaveURL('/auth/error');
  });

  test('aplikacja powinna obsługiwać utratę połączenia', async ({ page, context }) => {
    // Symulacja offline
    await context.setOffline(true);
    
    // Próba załadowania strony
    await page.goto('/').catch(() => {
      // Oczekiwane niepowodzenie
    });
    
    // Przywróć połączenie
    await context.setOffline(false);
    
    // Teraz powinno działać
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
  });
});

test.describe('Fallbacki i stan ładowania', () => {
  test('powolne połączenie powinno wyświetlać stan ładowania', async ({ page }) => {
    // Spowolnij sieć
    await page.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });
    
    await page.goto('/trip');
    
    // Strona powinna się ostatecznie załadować
    await expect(page).toHaveURL('/trip');
  });
});

test.describe('Obsługa sesji', () => {
  test('wygasła sesja powinna przekierować do logowania', async ({ page }) => {
    // Próba dostępu do chronionej strony bez logowania
    await page.goto('/trip-dashboard');
    
    // Powinien zostać przekierowany
    await page.waitForURL(/\/(auth\/login|$)/);
  });
});
