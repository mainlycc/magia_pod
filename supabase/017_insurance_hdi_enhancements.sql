-- 017: Rozszerzenie modułu ubezpieczeń o pełną integrację z HDI API
-- Dodanie pól wymaganych dla integracji z HDI Embedded API
-- 
-- UWAGA: Wymaga wcześniejszego uruchomienia migracji 007_insurance_tables.sql
-- 
-- Instrukcja uruchomienia:
-- 1. Najpierw uruchom 007_insurance_tables.sql (tworzy podstawowe tabele)
-- 2. Następnie uruchom ten plik (017_insurance_hdi_enhancements.sql)
-- 3. Po uruchomieniu odśwież cache Supabase (Settings → API → Restart API)
--    lub zrestartuj serwer Next.js

-- Rozszerzenie tabeli insurance_submissions
DO $$
BEGIN
  -- Sprawdź czy tabela istnieje
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions') THEN
    RAISE EXCEPTION 'Tabela insurance_submissions nie istnieje. Najpierw uruchom migrację 007_insurance_tables.sql';
  END IF;

  -- Dodaj nowe kolumny jeśli nie istnieją
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'external_offer_id') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN external_offer_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'external_policy_id') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN external_policy_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'external_policy_number') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN external_policy_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'hdi_product_code') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN hdi_product_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'hdi_variant_code') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN hdi_variant_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'hdi_payment_scheme_code') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN hdi_payment_scheme_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'sent_at') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN sent_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'last_sync_at') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN last_sync_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'sync_attempts') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN sync_attempts integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submissions' 
                 AND column_name = 'policy_status_code') THEN
    ALTER TABLE public.insurance_submissions 
    ADD COLUMN policy_status_code text;
  END IF;
END $$;

-- Rozszerzenie constraint statusu o nowe wartości
DO $$
BEGIN
  -- Usuń stary constraint jeśli istnieje
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'public' 
             AND table_name = 'insurance_submissions' 
             AND constraint_name = 'insurance_submissions_status_check') THEN
    ALTER TABLE public.insurance_submissions 
    DROP CONSTRAINT insurance_submissions_status_check;
  END IF;
END $$;

-- Dodaj nowy constraint z rozszerzonymi statusami
ALTER TABLE public.insurance_submissions 
ADD CONSTRAINT insurance_submissions_status_check 
CHECK (status IN ('pending', 'calculating', 'registered', 'sent', 'issued', 'accepted', 'error', 'cancelled', 'manual_check_required'));

-- Indeksy dla nowych kolumn
CREATE INDEX IF NOT EXISTS insurance_submissions_external_offer_id_idx 
  ON public.insurance_submissions(external_offer_id);
CREATE INDEX IF NOT EXISTS insurance_submissions_external_policy_id_idx 
  ON public.insurance_submissions(external_policy_id);
CREATE INDEX IF NOT EXISTS insurance_submissions_external_policy_number_idx 
  ON public.insurance_submissions(external_policy_number);
CREATE INDEX IF NOT EXISTS insurance_submissions_policy_status_code_idx 
  ON public.insurance_submissions(policy_status_code);

-- Rozszerzenie tabeli insurance_submission_participants
DO $$
BEGIN
  -- Sprawdź czy tabela istnieje
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submission_participants') THEN
    RAISE EXCEPTION 'Tabela insurance_submission_participants nie istnieje. Najpierw uruchom migrację 007_insurance_tables.sql';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submission_participants' 
                 AND column_name = 'hdi_person_uid') THEN
    ALTER TABLE public.insurance_submission_participants 
    ADD COLUMN hdi_person_uid text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submission_participants' 
                 AND column_name = 'hdi_order') THEN
    ALTER TABLE public.insurance_submission_participants 
    ADD COLUMN hdi_order integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'insurance_submission_participants' 
                 AND column_name = 'status') THEN
    ALTER TABLE public.insurance_submission_participants 
    ADD COLUMN status text;
  END IF;
END $$;

-- Rozszerzenie tabeli participants
DO $$
BEGIN
  -- Sprawdź czy tabela istnieje
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'participants') THEN
    RAISE EXCEPTION 'Tabela participants nie istnieje. Najpierw uruchom podstawowe migracje.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'participants' 
                 AND column_name = 'citizenship_code') THEN
    ALTER TABLE public.participants 
    ADD COLUMN citizenship_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'participants' 
                 AND column_name = 'gender_code') THEN
    ALTER TABLE public.participants 
    ADD COLUMN gender_code text;
  END IF;
END $$;

-- Tabela produktów ubezpieczeniowych
CREATE TABLE IF NOT EXISTS public.insurance_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  variant_code text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_products_code_idx ON public.insurance_products(code);
CREATE INDEX IF NOT EXISTS insurance_products_is_default_idx ON public.insurance_products(is_default) WHERE is_default = true;
ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;

-- Trigger dla updated_at w insurance_products
CREATE TRIGGER insurance_products_updated_at
  BEFORE UPDATE ON public.insurance_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policy dla insurance_products
DROP POLICY IF EXISTS insurance_products_admin_all ON public.insurance_products;
CREATE POLICY insurance_products_admin_all
ON public.insurance_products
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Tabela logów operacji ubezpieczeniowych
CREATE TABLE IF NOT EXISTS public.insurance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.insurance_submissions(id) ON DELETE CASCADE,
  operation_type text NOT NULL CHECK (operation_type IN ('calculate', 'register', 'issue', 'sync', 'cancel', 'payment')),
  status text NOT NULL CHECK (status IN ('success', 'error')),
  request_payload jsonb,
  response_payload jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_logs_submission_id_idx ON public.insurance_logs(submission_id);
CREATE INDEX IF NOT EXISTS insurance_logs_operation_type_idx ON public.insurance_logs(operation_type);
CREATE INDEX IF NOT EXISTS insurance_logs_created_at_idx ON public.insurance_logs(created_at);
ALTER TABLE public.insurance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy dla insurance_logs
DROP POLICY IF EXISTS insurance_logs_admin_all ON public.insurance_logs;
CREATE POLICY insurance_logs_admin_all
ON public.insurance_logs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Rozszerzenie tabeli trips o pole insurance_product_code (opcjonalne)
DO $$
BEGIN
  -- Sprawdź czy tabela istnieje
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'trips') THEN
    RAISE EXCEPTION 'Tabela trips nie istnieje. Najpierw uruchom podstawowe migracje.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'trips' 
                 AND column_name = 'insurance_product_code') THEN
    ALTER TABLE public.trips 
    ADD COLUMN insurance_product_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'trips' 
                 AND column_name = 'insurance_required') THEN
    ALTER TABLE public.trips 
    ADD COLUMN insurance_required boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Indeks dla insurance_product_code w trips
CREATE INDEX IF NOT EXISTS trips_insurance_product_code_idx 
  ON public.trips(insurance_product_code);
