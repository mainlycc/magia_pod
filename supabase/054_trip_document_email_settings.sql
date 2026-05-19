-- 054: Ustawienia wysyłki dokumentów w mailu po rezerwacji (per wycieczka)

CREATE TABLE IF NOT EXISTS public.trip_document_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'rodo',
    'terms',
    'conditions',
    'agreement',
    'conditions_de_pl',
    'standard_form',
    'electronic_services',
    'rodo_info',
    'insurance_terms'
  )),
  attach_on_reservation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, document_type)
);

CREATE INDEX IF NOT EXISTS trip_document_email_settings_trip_id_idx
  ON public.trip_document_email_settings(trip_id);

DROP TRIGGER IF EXISTS update_trip_document_email_settings_updated_at ON public.trip_document_email_settings;
CREATE TRIGGER update_trip_document_email_settings_updated_at
  BEFORE UPDATE ON public.trip_document_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.trip_document_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_document_email_settings_read ON public.trip_document_email_settings;
CREATE POLICY trip_document_email_settings_read
ON public.trip_document_email_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS trip_document_email_settings_admin_all ON public.trip_document_email_settings;
CREATE POLICY trip_document_email_settings_admin_all
ON public.trip_document_email_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
