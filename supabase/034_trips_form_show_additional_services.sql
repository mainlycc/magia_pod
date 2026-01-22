-- 034: Dodanie pola form_show_additional_services do tabeli trips
-- Pole boolean określające czy krok "usługi dodatkowe" ma być widoczny w formularzu

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_show_additional_services'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN form_show_additional_services boolean DEFAULT false;
    RAISE NOTICE 'Kolumna form_show_additional_services została dodana';
  ELSE
    RAISE NOTICE 'Kolumna form_show_additional_services już istnieje';
  END IF;
END $$;
