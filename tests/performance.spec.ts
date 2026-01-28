import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('strona główna powinna się załadować szybko', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    // Strona powinna załadować się w mniej niż 5 sekund
    expect(loadTime).toBeLessThan(5000);
  });

  test('nawigacja między stronami powinna być płynna', async ({ page }) => {
    await page.goto('/');
    
    const startTime = Date.now();
    await page.getByRole('link', { name: 'Zobacz wycieczki' }).click();
    await page.waitForURL('/trip');
    const navigationTime = Date.now() - startTime;
    
    // Nawigacja powinna być szybka
    expect(navigationTime).toBeLessThan(3000);
  });

  test('nie powinno być błędów konsoli', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    
    // Filtruj znane błędy z zewnętrznych bibliotek
    const relevantErrors = consoleErrors.filter(error => 
      !error.includes('favicon.ico') && 
      !error.includes('Hydration')
    );
    
    expect(relevantErrors.length).toBe(0);
  });

  test('nie powinno być błędów sieciowych', async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on('requestfailed', (request) => {
      failedRequests.push(request.url());
    });
    
    await page.goto('/');
    
    // Pomiń znane opcjonalne zasoby
    const relevantFails = failedRequests.filter(url => 
      !url.includes('favicon.ico')
    );
    
    expect(relevantFails.length).toBe(0);
  });
});
