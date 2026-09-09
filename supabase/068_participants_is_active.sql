-- 068: Flaga aktywności uczestnika (wyłączenie z raportów / rozliczeń bez usuwania)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'participants'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.participants
      ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    RAISE NOTICE 'Kolumna is_active została dodana';
  ELSE
    RAISE NOTICE 'Kolumna is_active już istnieje';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS participants_is_active_idx
  ON public.participants (is_active);

COMMENT ON COLUMN public.participants.is_active IS
  'Gdy false, uczestnik jest wyłączony z raportów, rozliczeń i eksportów operacyjnych.';
