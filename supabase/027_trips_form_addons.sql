-- 027: Konfiguracja dodatków formularza (atrakcje, diety, ubezpieczenia) na poziomie wycieczki

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_additional_attractions'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN form_additional_attractions jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_diets'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN form_diets jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_extra_insurances'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN form_extra_insurances jsonb;
  END IF;
END $$;


