-- 042: Tabela szablonów umów dla wycieczek

-- 1. Utworzenie tabeli trip_agreement_templates
CREATE TABLE IF NOT EXISTS public.trip_agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  registration_type text NOT NULL CHECK (registration_type IN ('individual', 'company')),
  template_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, registration_type)
);

-- 2. Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS trip_agreement_templates_trip_id_idx ON public.trip_agreement_templates(trip_id);
CREATE INDEX IF NOT EXISTS trip_agreement_templates_registration_type_idx ON public.trip_agreement_templates(registration_type);

-- 3. Trigger dla automatycznej aktualizacji updated_at
DROP TRIGGER IF EXISTS update_trip_agreement_templates_updated_at ON public.trip_agreement_templates;
CREATE TRIGGER update_trip_agreement_templates_updated_at
  BEFORE UPDATE ON public.trip_agreement_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Polityki RLS
ALTER TABLE public.trip_agreement_templates ENABLE ROW LEVEL SECURITY;

-- Odczyt dla wszystkich zalogowanych użytkowników
DROP POLICY IF EXISTS trip_agreement_templates_read ON public.trip_agreement_templates;
CREATE POLICY trip_agreement_templates_read
ON public.trip_agreement_templates
FOR SELECT
TO authenticated
USING (true);

-- Modyfikacja tylko dla adminów
DROP POLICY IF EXISTS trip_agreement_templates_admin_all ON public.trip_agreement_templates;
CREATE POLICY trip_agreement_templates_admin_all
ON public.trip_agreement_templates
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
