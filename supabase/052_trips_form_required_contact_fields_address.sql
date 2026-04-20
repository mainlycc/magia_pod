-- 052: Rozszerzenie form_required_contact_fields o "address"
-- Struktura: { "pesel": boolean, "phone": boolean, "email": boolean, "address": boolean }
-- Domyślnie: address = false (opcjonalny)

DO $$
BEGIN
  -- Ustaw nowy domyślny JSONB (dla nowych rekordów)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'form_required_contact_fields'
  ) THEN
    ALTER TABLE public.trips
      ALTER COLUMN form_required_contact_fields
      SET DEFAULT '{"pesel": false, "phone": true, "email": true, "address": false}'::jsonb;

    -- Backfill: dodaj klucz "address" jeśli go brakuje
    UPDATE public.trips
      SET form_required_contact_fields =
        jsonb_set(
          COALESCE(form_required_contact_fields, '{}'::jsonb),
          '{address}',
          'false'::jsonb,
          true
        )
      WHERE NOT (COALESCE(form_required_contact_fields, '{}'::jsonb) ? 'address');
  END IF;
END $$;

