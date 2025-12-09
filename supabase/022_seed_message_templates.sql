-- 022: Przykładowe szablony wiadomości
-- Dodanie przykładowych szablonów wiadomości grupowych do tabeli message_templates

BEGIN;

-- Szablon 1: Przypomnienie o płatności
INSERT INTO public.message_templates (
  id,
  title,
  subject,
  body,
  created_at,
  updated_at
)
VALUES (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'Przypomnienie o płatności',
  'Przypomnienie o płatności za wycieczkę',
  'Szanowni Państwo,

Przypominamy o konieczności dokonania płatności za wycieczkę. Prosimy o uregulowanie należności w terminie wskazanym w umowie.

W przypadku pytań prosimy o kontakt.

Z poważaniem,
Zespół Magia Podróżowania',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Szablon 2: Instrukcja co zabrać
INSERT INTO public.message_templates (
  id,
  title,
  subject,
  body,
  created_at,
  updated_at
)
VALUES (
  'bbbbbbbb-2222-2222-2222-222222222222',
  'Instrukcja co zabrać na wycieczkę',
  'Co zabrać na wycieczkę - lista rzeczy',
  'Szanowni Państwo,

Przed wyjazdem prosimy o przygotowanie następujących rzeczy:

• Dokumenty: paszport/dowód osobisty (sprawdźcie ważność!)
• Ubrania odpowiednie do pogody i klimatu
• Buty wygodne do chodzenia
• Apteczka z podstawowymi lekami
• Ładowarki do telefonów/kamer
• Adaptery do gniazdek (jeśli wymagane)
• Ubezpieczenie podróżne (jeśli nie jest wliczone)

Szczegółowe informacje znajdziecie w programie wycieczki.

Życzymy udanego wyjazdu!
Zespół Magia Podróżowania',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Szablon 3: Przypomnienie o wyjeździe
INSERT INTO public.message_templates (
  id,
  title,
  subject,
  body,
  created_at,
  updated_at
)
VALUES (
  'cccccccc-3333-3333-3333-333333333333',
  'Przypomnienie o zbliżającym się wyjeździe',
  'Przypomnienie o zbliżającym się wyjeździe',
  'Szanowni Państwo,

Przypominamy, że Wasz wyjazd zbliża się wielkimi krokami!

Prosimy o:
• Potwierdzenie obecności na miejscu zbiórki
• Sprawdzenie dokumentów podróży
• Przygotowanie bagażu zgodnie z wcześniejszymi wytycznymi
• Kontakt w przypadku jakichkolwiek pytań

Szczegóły dotyczące miejsca i godziny zbiórki otrzymacie w osobnej wiadomości.

Do zobaczenia!
Zespół Magia Podróżowania',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Szablon 4: Przypomnienie o paszporcie
INSERT INTO public.message_templates (
  id,
  title,
  subject,
  body,
  created_at,
  updated_at
)
VALUES (
  'dddddddd-4444-4444-4444-444444444444',
  'Przypomnienie o zabraniu paszportu',
  'WAŻNE: Przypomnienie o zabraniu paszportu',
  'Szanowni Państwo,

Przypominamy o konieczności zabrania ważnego paszportu na wycieczkę.

PASZPORT MUSI BYĆ WAŻNY MINIMUM 6 MIESIĘCY OD DATY WYJAZDU.

Prosimy o:
• Sprawdzenie ważności paszportu
• Zabranie paszportu w dniu wyjazdu
• Przygotowanie kopii paszportu (na wszelki wypadek)

Bez ważnego paszportu nie będzie możliwości uczestnictwa w wycieczce.

W razie pytań prosimy o kontakt.

Z poważaniem,
Zespół Magia Podróżowania',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

