-- 045: Dodanie pola form_required_contact_fields do tabeli trips
-- Pole JSONB określające które pola osoby zgłaszającej są wymagane w formularzu rezerwacji
-- Struktura: { "pesel": boolean, "phone": boolean, "email": boolean }
-- Domyślnie phone i email są wymagane (true), pesel nie (false)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_required_contact_fields'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN form_required_contact_fields jsonb DEFAULT '{"pesel": false, "phone": true, "email": true}'::jsonb;
  END IF;
END $$;
