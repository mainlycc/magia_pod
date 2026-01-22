-- 033: Dodanie kolumny selected_services do tabeli participants
-- Pole JSONB do przechowywania wybranych usług dodatkowych przypisanych do uczestnika

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'participants'
      AND column_name = 'selected_services'
  ) THEN
    ALTER TABLE public.participants
      ADD COLUMN selected_services jsonb DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Kolumna selected_services została dodana';
  ELSE
    RAISE NOTICE 'Kolumna selected_services już istnieje';
  END IF;
END $$;
