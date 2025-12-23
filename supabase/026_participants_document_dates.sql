-- 026: Rozszerzenie danych dokumentu uczestnika o daty wydania i ważności

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'participants'
      AND column_name = 'document_issue_date'
  ) THEN
    ALTER TABLE public.participants
      ADD COLUMN document_issue_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'participants'
      AND column_name = 'document_expiry_date'
  ) THEN
    ALTER TABLE public.participants
      ADD COLUMN document_expiry_date date;
  END IF;
END $$;


