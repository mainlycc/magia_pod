-- 070: Usuwanie uczestnika ma usuwać też jego ubezpieczenia (typ 2/3).
-- Wcześniej FK było ON DELETE SET NULL — wpisy zostawały w zakładce Ubezpieczenia
-- i UI pokazywało je z fallbackiem na dane kontaktowe rezerwacji.

-- Posprzątaj orphanowane rekordy po wcześniejszych usunięciach uczestników
DELETE FROM public.participant_insurances
WHERE participant_id IS NULL;

DO $$
DECLARE
  constraint_name text;
  constraint_def text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid)
  INTO constraint_name, constraint_def
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'participant_insurances'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%participant_id%REFERENCES%participants%';

  IF constraint_name IS NOT NULL AND constraint_def ILIKE '%ON DELETE CASCADE%' THEN
    RAISE NOTICE 'FK participant_insurances.participant_id już ma ON DELETE CASCADE';
    RETURN;
  END IF;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.participant_insurances DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;

  ALTER TABLE public.participant_insurances
    ADD CONSTRAINT participant_insurances_participant_id_fkey
    FOREIGN KEY (participant_id)
    REFERENCES public.participants(id)
    ON DELETE CASCADE;
END $$;
