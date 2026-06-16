-- 057: OWU ubezpieczeń per wycieczka (Typ 1/2/3) + ustawienia wysyłki po rezerwacji

CREATE TABLE IF NOT EXISTS public.trip_insurance_owu_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  insurance_type smallint NOT NULL CHECK (insurance_type IN (1, 2, 3)),
  file_name text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, insurance_type)
);

CREATE INDEX IF NOT EXISTS trip_insurance_owu_documents_trip_id_idx
  ON public.trip_insurance_owu_documents(trip_id);

CREATE INDEX IF NOT EXISTS trip_insurance_owu_documents_insurance_type_idx
  ON public.trip_insurance_owu_documents(insurance_type);

DROP TRIGGER IF EXISTS trip_insurance_owu_documents_updated_at ON public.trip_insurance_owu_documents;
CREATE TRIGGER trip_insurance_owu_documents_updated_at
  BEFORE UPDATE ON public.trip_insurance_owu_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.trip_insurance_owu_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_insurance_owu_documents_read ON public.trip_insurance_owu_documents;
CREATE POLICY trip_insurance_owu_documents_read
ON public.trip_insurance_owu_documents
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS trip_insurance_owu_documents_admin_all ON public.trip_insurance_owu_documents;
CREATE POLICY trip_insurance_owu_documents_admin_all
ON public.trip_insurance_owu_documents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================

CREATE TABLE IF NOT EXISTS public.trip_insurance_owu_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  insurance_type smallint NOT NULL CHECK (insurance_type IN (1, 2, 3)),
  attach_on_reservation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, insurance_type)
);

CREATE INDEX IF NOT EXISTS trip_insurance_owu_email_settings_trip_id_idx
  ON public.trip_insurance_owu_email_settings(trip_id);

DROP TRIGGER IF EXISTS trip_insurance_owu_email_settings_updated_at ON public.trip_insurance_owu_email_settings;
CREATE TRIGGER trip_insurance_owu_email_settings_updated_at
  BEFORE UPDATE ON public.trip_insurance_owu_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.trip_insurance_owu_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_insurance_owu_email_settings_read ON public.trip_insurance_owu_email_settings;
CREATE POLICY trip_insurance_owu_email_settings_read
ON public.trip_insurance_owu_email_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS trip_insurance_owu_email_settings_admin_all ON public.trip_insurance_owu_email_settings;
CREATE POLICY trip_insurance_owu_email_settings_admin_all
ON public.trip_insurance_owu_email_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
