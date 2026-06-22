# Testy E2E — produkcja (Vercel)

Smoke + **pełny proces rezerwacji** przeciwko: **https://magia-pod.vercel.app/**

## Przygotowanie

```bash
cp .env.production.test.example .env.production.test
# Uzupełnij TEST_USER_PASSWORD (DANE.md)
pnpm test:e2e:production:env
```

## Uruchomienie

```bash
# Wszystkie testy produkcyjne (smoke + flow rezerwacji)
pnpm test:e2e:production

# Tylko pełna ścieżka klienta (rezerwacja, panel admina)
pnpm test:e2e:production:flow

# Personalizacja umowy: edytor → podgląd rezerwacji → PDF (opcj. Paynow)
pnpm test:e2e:production:agreement

# Tylko smoke (bez tworzenia rezerwacji)
pnpm exec playwright test tests/production/smoke-*.spec.ts -c playwright.production.config.ts
```

## Zakres

### Smoke (read-only)
| Plik | Co sprawdza |
|------|-------------|
| `smoke-public.spec.ts` | Strona główna, `/trip`, logowanie |
| `smoke-auth.spec.ts` | Logowanie admina |
| `smoke-dashboard.spec.ts` | Podstrony panelu |
| `smoke-agreement.spec.ts` | Zakładka Umowa |

### Pełny flow klienta (`flow-client-booking.spec.ts`)

Odpowiednik testów manualnych **B1.x** z `TESTY_MANUALNE.md`:

| Test | Opis |
|------|------|
| lista → szczegóły → formularz | Nawigacja klienta |
| walidacja pustych pól | Krok Kontakt |
| **B1.1** | Rezerwacja bez płatności → `/booking/[token]` |
| podgląd po tokenie | Strona rezerwacji |
| weryfikacja admina | `/trip-dashboard/rezerwacje`, `/uczestnicy` |
| **B1.2** *(opcjonalny)* | Rezerwuj i Zapłać → Paynow sandbox |
| macierz formularza | Osoba fiz. / firma, `?podglad=1` |

**Uwaga:** testy B1.1 **tworzą prawdziwą rezerwację** na produkcji (unikalny e-mail `e2e.prod.*@e2e.magia.test`).

### Płatność Paynow (B1.2)

W `.env.production.test`:

```env
PRODUCTION_E2E_PAYMENT=1
```

Wymaga `PAYNOW_ENV=sandbox` na serwerze Vercel.

## Zmienne

| Zmienna | Opis |
|---------|------|
| `PLAYWRIGHT_BASE_URL` | Domyślnie `https://magia-pod.vercel.app` |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | Admin (DANE.md) |
| `PRODUCTION_TRIP_SLUG` | Opcjonalny slug; bez niego — auto z `/api/trips` |
| `PRODUCTION_E2E_PAYMENT` | `1` = uruchom test płatności B1.2 |

## Raport

```bash
pnpm test:e2e:production:report
```
