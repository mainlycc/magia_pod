-- 060: Globalne ustawienia wysyłki OWU po rezerwacji (per typ ubezpieczenia)
-- Zastępuje konfigurację per wycieczka — ustawienia OWU przeniesione do panelu globalnego.

CREATE TABLE IF NOT EXISTS public.global_insurance_owu_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_type smallint NOT NULL CHECK (insurance_type IN (1, 2, 3)),
  attach_on_reservation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurance_type)
);

DROP TRIGGER IF EXISTS global_insurance_owu_email_settings_updated_at ON public.global_insurance_owu_email_settings;
CREATE TRIGGER global_insurance_owu_email_settings_updated_at
  BEFORE UPDATE ON public.global_insurance_owu_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.global_insurance_owu_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_insurance_owu_email_settings_read ON public.global_insurance_owu_email_settings;
CREATE POLICY global_insurance_owu_email_settings_read
ON public.global_insurance_owu_email_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS global_insurance_owu_email_settings_admin_all ON public.global_insurance_owu_email_settings;
CREATE POLICY global_insurance_owu_email_settings_admin_all
ON public.global_insurance_owu_email_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
