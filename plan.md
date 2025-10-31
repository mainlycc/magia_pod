<!-- 3b8f4a2a-355d-4fdb-bfe7-d92612b91d35 2b23a81f-27f5-4cd3-931b-021d3eb33be4 -->
# Plan wdrożenia: MVP i następne fazy (bez Paynow w MVP)

## Założenia ogólne

- Wszystko w komponentach shadcn/ui. Jeśli brak komponentu – instalujemy go i używamy (nigdy nie kopiujemy ręcznie).
- Frontend: Next.js App Router. Backend: Next.js API routes (obecny styl). Supabase: Auth, DB, Storage, RLS.
- Role: `admin`, `coordinator` w `public.profiles` (już w schemacie). RBAC w middleware i layoutach.

## MVP (bez Paynow)

Cel: działająca rezerwacja z PDF i e-mailem + prosty panel admina i koordynatora.

### Publiczny moduł rezerwacji

- Strona wycieczki (już jest): dopracowanie UI (galeria shadcn, lepszy layout karty).
- Formularz rezerwacji – wizard 3 kroki (shadcn `form`, `input`, `checkbox`, `tabs` lub `steps`-like UX z `Tabs`/`Breadcrumb`):

1) Dane kontaktowe i adres

2) Uczestnicy (lista dynamiczna: imię, nazwisko, PESEL, e-mail, telefon, dokument)

3) Zgody RODO/regulaminy + podgląd umowy (PDF generowany po submit – pozostajemy przy `/api/pdf`) i podsumowanie

- Po zapisie: generacja PDF (`/api/pdf`) + e-mail z załącznikiem (`/api/email`). Status rezerwacji: `confirmed` (jak obecnie) – bez płatności.

### Panel Administracyjny (CRM – MVP)

- Shell panelu (layout z sidebar + topbar w shadcn; stałe na wszystkich stronach): `app/admin/(shell)/layout.tsx`.
- Dashboard (liczniki podstawowe z Supabase): rezerwacje dziś/tydzień/łącznie, obłożenie (prosty %), sprzedaż (sumy cen – bez integracji płatności, liczona z `bookings` × `price_cents`).
- Lista wycieczek: tabela shadcn (`table`, `pagination`, `dropdown-menu`): nazwa, termin, cena, miejsca, status; akcje: dodaj, edytuj, archiwizuj/aktywuj, duplikuj (duplikacja = insert z nowym slugiem).
- Uczestnicy/rezerwacje: widok na poziomie wycieczki – tabela uczestników i rezerwacji, szybka zmiana statusu rezerwacji; eksport CSV (server action prosta generacja CSV).
- Płatności (MVP): pole statusu rezerwacji ręcznie ustawiane (`brak`, `częściowa`, `pełna`, `nadpłata`) – bez rozliczeń bankowych.

### Panel Koordynatora (MVP)

- Dostęp tylko do wybranych `trip_id` z `profiles.allowed_trip_ids`.
- Widok listy uczestników + status płatności rezerwacji (read-only) i przycisk wysyłki wiadomości grupowej (korzysta z `/api/email`).

### Technika i pliki (MVP)

- RBAC: aktualizacja `with-supabase-app/lib/supabase/middleware.ts` – ochrona ścieżek `/admin/**` (admin) i `/coord/**` (koordynator).
- Publiczny moduł:
  - `app/trip/[slug]/page.tsx` – dopracowanie UI (karty, galeria shadcn)
  - `app/trip/[slug]/reserve/page.tsx` – refaktor do wizardu (shadcn forms, steps via `Tabs` lub `Breadcrumb`)
  - `app/api/bookings/route.ts` – walidacja payloadu, zapisywanie zgód, drobne twardości na race-conditions
  - `app/api/pdf/route.ts` – pozostaje, ewentualny szablon PDF dopracowany
  - `app/api/email/route.ts` – pozostaje
- Admin:
  - `app/admin/layout.tsx` + `app/admin/page.tsx` (dashboard)
  - `app/admin/trips/page.tsx`, `app/admin/trips/[id]/edit/page.tsx`
  - `app/admin/trips/[id]/bookings/page.tsx`
- Koordynator:
  - `app/coord/layout.tsx`, `app/coord/page.tsx`, `app/coord/trips/[id]/participants/page.tsx`
- Komponenty shadcn do dodania jeśli brak: `breadcrumb`, `sonner` (toasty), `alert`, `separator`, `accordion` lub `tabs` jako kroki, `avatar` (opcjonalnie), `chart` – wykresy później.
- DB (MVP uzupełnienia):
  - Rozszerzyć `bookings`: pola `consents` (jsonb), `payment_status` (enum tekstowy), `agreement_pdf_url` (już jest w pdf route), indeksy
  - `participants`: już jest – ewent. walidacje

## Następne fazy (po MVP)

### Integracje płatności i rozliczeń

- Paynow (sandbox → produkcja): utworzenie `/api/payments/paynow/init` (HMAC, kwota, ref), `/api/payments/paynow/notify` (webhook IPN), update `payment_status` w `bookings`.
- mBank: import CSV lub API; dopasowanie po `booking_ref`, kwocie i dacie; automatyczna aktualizacja `payment_status`.

### Faktury (Saldeo Smart)

- Generowanie i wysyłka faktur PDF; powiązanie z płatnością; tabela `invoices` + statusy; endpointy serwerowe do tworzenia i webhook aktualizacji.

### Ubezpieczenia (HDI)

- Wysyłka listy uczestników do HDI API; zapis numeru polisy; tabela `insurance_policies` i linkowanie do `bookings`.

### Komunikacja i szablony

- Szablony wiadomości (DB + prosty edytor); wysyłki masowe (kolejkowanie – cron lub edge); historia wysyłek.

### Dashboard PRO i eksporty

- Wykresy (Recharts) – sprzedaż, obłożenie w czasie; filtry.
- Eksporty CSV/PDF na poziomie wycieczki i globalnym.

## Istniejący kod do wykorzystania

- Publiczne: `app/trip/[slug]` i `reserve` – rozbudowa UI i walidacji.
- API: `app/api/bookings`, `app/api/pdf`, `app/api/email` – rozbudowa, bez łamania istniejących kontraktów.
- Supabase: `profiles`, `trips`, `bookings`, `participants` – rozszerzenia pól i indeksów.

## Komponenty shadcn (instalacje, jeśli brak)

- `form`, `input`, `textarea`, `checkbox`, `select`, `tabs`, `breadcrumb`, `dialog`, `dropdown-menu`, `table`, `pagination`, `sonner`, `alert`, `separator`.

## Komendy instalacyjne (do wykonania ręcznie w razie braków)

```bash
# przykłady (wykonuj tylko brakujące)
npx shadcn@latest add breadcrumb dialog dropdown-menu table pagination tabs alert separator sonner
```

### To-dos

- [ ] Przebudować rezerwację na 3‑krokowy wizard w shadcn (forms, tabs)
- [ ] Dopieścić UI strony wycieczki i galerii w shadcn
- [ ] Utwardzić /api/bookings (walidacja, zgody, race conditions)
- [ ] Uspójnić szablon PDF i e-mail; zapisywać agreement_pdf_url
- [x] Stworzyć layout admina (sidebar/topbar) w shadcn
- [ ] Lista/CRUD wycieczek z tabelą shadcn i akcjami
- [ ] Widok rezerwacji/uczestników; eksport CSV; ręczne statusy płatności
- [ ] Panel koordynatora: lista uczestników; mass email
- [x] RBAC w middleware (ochrona /admin i /coord), check roli z profiles
- [ ] Doinstalować brakujące komponenty shadcn wymienione w planie
- [ ] Integracja Paynow: init i webhook; aktualizacja payment_status
- [ ] Import CSV/API mBank i dopasowanie wpłat
- [ ] Integracja Saldeo Smart: tworzenie i wysyłka faktur
- [ ] Integracja HDI: wysyłka list uczestników i polisy
- [ ] Dashboard PRO z wykresami i filtrami
- [ ] Eksporty CSV/PDF globalnie i per wycieczka
- [ ] Szablony komunikacji i mass mail z historią