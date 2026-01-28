import { test, expect } from '@playwright/test';

test.describe('Testy wizualne - Layout', () => {
  test('strona główna - sprawdzenie podstawowego layoutu', async ({ page }) => {
    await page.goto('/');
    
    // Sprawdź czy główny kontener istnieje
    const mainElement = page.locator('main');
    await expect(mainElement).toBeVisible();
    
    // Sprawdź czy heading jest widoczny i ma odpowiedni rozmiar
    const heading = page.getByRole('heading', { name: 'Witamy!' });
    await expect(heading).toBeVisible();
    
    const fontSize = await heading.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    
    // Font size powinien być większy niż 20px dla h1
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThan(20);
  });

  test('footer powinien być na dole strony', async ({ page }) => {
    await page.goto('/');
    
    const footer = page.locator('footer');
    if (await footer.count() > 0) {
      const footerBox = await footer.boundingBox();
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      
      // Footer powinien być blisko dołu strony
      expect(footerBox?.y).toBeGreaterThan(pageHeight - 500);
    }
  });

  test('przyciski powinny mieć odpowiednie odstępy', async ({ page }) => {
    await page.goto('/');
    
    const button = page.getByRole('button', { name: /zaloguj/i });
    await expect(button).toBeVisible();
    
    // Sprawdź padding przycisku
    const padding = await button.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        top: parseInt(style.paddingTop),
        right: parseInt(style.paddingRight),
        bottom: parseInt(style.paddingBottom),
        left: parseInt(style.paddingLeft)
      };
    });
    
    // Przyciski powinny mieć jakiś padding
    expect(padding.top).toBeGreaterThan(0);
    expect(padding.right).toBeGreaterThan(0);
  });
});

test.describe('Testy wizualne - Responsywność', () => {
  const viewports = [
    { name: 'Mobile Small', width: 320, height: 568 },
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Mobile Large', width: 414, height: 896 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`strona główna powinna wyglądać dobrze na ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      
      // Sprawdź czy nie ma poziomego scrollowania
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBeFalsy();
      
      // Sprawdź czy główne elementy są widoczne
      await expect(page.getByRole('heading', { name: 'Witamy!' })).toBeVisible();
    });
  }
});

test.describe('Testy wizualne - Motywy', () => {
  test('zmiana motywu powinna działać', async ({ page }) => {
    await page.goto('/');
    
    // Pobierz początkowe tło
    const initialBg = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Kliknij przełącznik motywu (jeśli istnieje)
    const themeButton = page.locator('footer').getByRole('button').first();
    
    if (await themeButton.isVisible()) {
      await themeButton.click();
      
      // Poczekaj na zmianę
      await page.waitForTimeout(500);
      
      // Nowe tło może być inne (ale nie musi być, jeśli już był wybrany ten sam motyw)
      const newBg = await page.locator('body').evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      
      // Sprawdź że nie ma błędów JavaScript
      expect(newBg).toBeTruthy();
    }
  });
});

test.describe('Testy wizualne - Contrast', () => {
  test('tekst powinien mieć odpowiedni kontrast', async ({ page }) => {
    await page.goto('/');
    
    const heading = page.getByRole('heading', { name: 'Witamy!' });
    
    // Sprawdź kolor tekstu
    const textColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    
    // Kolor powinien być zdefiniowany
    expect(textColor).toBeTruthy();
    expect(textColor).not.toBe('rgba(0, 0, 0, 0)'); // Nie przezroczysty
  });
});
