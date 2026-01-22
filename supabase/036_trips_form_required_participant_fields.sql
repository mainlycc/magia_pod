-- 036: Dodanie pola form_required_participant_fields do tabeli trips
-- Pole JSONB określające które pola uczestników są wymagane w formularzu rezerwacji
-- Struktura: { "pesel": boolean, "document": boolean, "gender": boolean, "phone": boolean }

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_required_participant_fields'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN form_required_participant_fields jsonb DEFAULT NULL;
  END IF;
END $$;
