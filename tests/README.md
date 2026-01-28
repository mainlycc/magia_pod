# Testy Playwright dla Magia Podróżowania

## Struktura testów

### 📁 Pliki testowe

- **`home.spec.ts`** - Testy strony głównej i podstawowych elementów UI
- **`navigation.spec.ts`** - Testy nawigacji i responsywności
- **`auth.spec.ts`** - Testy autentykacji (logowanie, rejestracja, resetowanie hasła)
- **`trips-public.spec.ts`** - Testy publicznych stron wycieczek
- **`accessibility.spec.ts`** - Testy dostępności (a11y)
- **`performance.spec.ts`** - Testy wydajności
- **`helpers/auth.ts`** - Helpery do testów autentykacji

## Uruchamianie testów

### Wszystkie przeglądarki
```bash
pnpm exec playwright test
```

### Tylko Chrome
```bash
pnpm exec playwright test --project=chromium
```

### Tylko Firefox
```bash
pnpm exec playwright test --project=firefox
```

### Konkretny plik testowy
```bash
pnpm exec playwright test tests/home.spec.ts
```

### Z interfejsem UI
```bash
pnpm exec playwright test --ui
```

### W trybie debug
```bash
pnpm exec playwright test --debug
```

### Headed mode (widoczna przeglądarka)
```bash
pnpm exec playwright test --headed
```

## Przeglądanie raportów

Po uruchomieniu testów, otwórz raport HTML:
```bash
pnpm exec playwright show-report
```

## Konfiguracja zmiennych środowiskowych

Dla testów autentykacji, utwórz plik `.env.test` (lub dodaj do `.env.local`):

```env
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testowehaslo123
```

## Dostosowanie konfiguracji

Edytuj plik `playwright.config.ts` aby:
- Zmienić liczbę workers
- Dodać nowe przeglądarki
- Zmienić timeouty
- Skonfigurować CI/CD

## Best Practices

### 1. Używaj selektorów opartych na rolach
```typescript
// ✅ Dobre
await page.getByRole('button', { name: 'Zaloguj' });

// ❌ Złe
await page.locator('.btn-login');
```

### 2. Czekaj na nawigację
```typescript
await page.getByRole('link', { name: 'Wycieczki' }).click();
await page.waitForURL('/trip');
```

### 3. Izoluj testy
Każdy test powinien działać niezależnie. Używaj `beforeEach` do setup.

### 4. Grupuj powiązane testy
```typescript
test.describe('Autentykacja', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });
  
  test('test 1', async ({ page }) => { /* ... */ });
  test('test 2', async ({ page }) => { /* ... */ });
});
```

## Rozszerzanie testów

### Dodawanie nowych testów dla zalogowanych użytkowników

1. Użyj helpera `loginUser` z `helpers/auth.ts`
2. Upewnij się, że masz prawidłowe credentials testowe
3. Dodaj testy w nowym pliku, np. `tests/dashboard.spec.ts`

Przykład:
```typescript
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('powinien wyświetlić listę wycieczek', async ({ page }) => {
    await expect(page.getByText('Moje wycieczki')).toBeVisible();
  });
});
```

## Debugowanie

### 1. Playwright Inspector
```bash
pnpm exec playwright test --debug
```

### 2. Screenshots i wideo
Automatycznie zapisywane przy niepowodzeniu testu w folderze `test-results/`

### 3. Trace Viewer
```bash
pnpm exec playwright show-trace test-results/<ścieżka-do-trace.zip>
```

## CI/CD

W GitHub Actions / GitLab CI, dodaj:

```yaml
- name: Install Playwright
  run: pnpm exec playwright install --with-deps

- name: Run tests
  run: pnpm exec playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Więcej informacji

- [Dokumentacja Playwright](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
