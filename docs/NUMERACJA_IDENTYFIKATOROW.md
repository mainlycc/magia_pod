# Numeracja identyfikatorów — Magia Podróżowania

Dokument referencyjny dla maili, umów PDF i panelu admina.

## Publiczne numery (widoczne dla klienta)

| Termin | Przykład | Źródło w systemie | Gdzie używany |
|--------|----------|-------------------|---------------|
| **Numer wycieczki** | `123456` | `trips.reservation_number` | Formularz wycieczki, strona publiczna, raporty |
| **Numer rezerwacji** | `123456/001` | `formatPublicAgreementNumber({ tripNumber, agreementSeq })` | Maile, umowy, panel rezerwacji |
| **Numer umowy** | `123456/001` | To samo co numer rezerwacji | Maile potwierdzające, tytuł przelewu, umowa PDF |

Skład publicznego numeru (`123456/001`):

1. **123456** — kod wyjazdu (`trips.reservation_number`), jeden na całą wycieczkę
2. **001** — kolejność umowy na wycieczce (`agreements.agreement_seq`)

Format: `AAAAAA/BBB` (z zerami wiodącymi według `lib/agreements/agreement-number-spec.ts`).

## Wewnętrzne numery (NIE publikować w mailach do klienta)

| Termin | Przykład | Źródło | Uwagi |
|--------|----------|--------|-------|
| **Numer płatności (operator)** | np. ID PayNow | `bookings.booking_ref` | Identyfikator techniczny płatności — tylko integracja PayNow / webhooki |
| **ID rezerwacji (baza)** | UUID | `bookings.id` | Wyłącznie wewnętrznie |

## Zasady w mailach transakcyjnych

- Tytuł potwierdzenia rezerwacji: `Potwierdzenie rezerwacji {numer_umowy} | {nazwa_wycieczki}`
- W treści „Numer umowy” i „Numer rezerwacji” = publiczny numer `123456/001`
- „Numer wycieczki” = sam kod wyjazdu `123456` (gdy potrzebny kontekst wycieczki)
- **Nigdy** nie umieszczaj `booking_ref` (PayNow) w treści maila do klienta
- Nazwa załącznika umowy: `Umowa_123456-001.pdf` (slash zamieniony na myślnik)

## Powiązane pliki

- `lib/agreements/agreement-number-spec.ts` — logika formatowania
- `lib/email/templates/booking-confirmation.ts` — mail potwierdzenia rezerwacji
- `app/api/bookings/route.ts` — wysyłka maila po rezerwacji
