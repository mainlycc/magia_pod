-- 051: Moduł ubezpieczeń lokalnych
-- Obsługa 3 typów ubezpieczeń: podstawowe (PZU), dodatkowe medyczne (TU Europa), KR (TU Europa)
-- Niezależny od modułu HDI (insurance_submissions)

-- ============================================================
-- 1. Globalny słownik wariantów ubezpieczeń
-- ============================================================
CREATE TABLE IF NOT EXISTS public.insurance_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type smallint NOT NULL CHECK (type IN (1, 2, 3)),
  name text NOT NULL,
  provider text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_variants_type_idx ON public.insurance_variants(type);
CREATE INDEX IF NOT EXISTS insurance_variants_is_active_idx ON public.insurance_variants(is_active);

ALTER TABLE public.insurance_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_variants_admin_all ON public.insurance_variants;
CREATE POLICY insurance_variants_admin_all
ON public.insurance_variants FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 2. Warianty przypisane do konkretnej wycieczki (konfiguracja lokalna)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_insurance_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.insurance_variants(id) ON DELETE RESTRICT,
  price_grosz integer CHECK (price_grosz >= 0), -- null dla typu 1 (wliczone w cenę)
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, variant_id)
);

CREATE INDEX IF NOT EXISTS trip_insurance_variants_trip_id_idx ON public.trip_insurance_variants(trip_id);
CREATE INDEX IF NOT EXISTS trip_insurance_variants_variant_id_idx ON public.trip_insurance_variants(variant_id);

ALTER TABLE public.trip_insurance_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_insurance_variants_admin_all ON public.trip_insurance_variants;
CREATE POLICY trip_insurance_variants_admin_all
ON public.trip_insurance_variants FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 3. Ubezpieczenia zakupione przez uczestników
-- ============================================================
CREATE TABLE IF NOT EXISTS public.participant_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  trip_insurance_variant_id uuid NOT NULL REFERENCES public.trip_insurance_variants(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'purchased' CHECK (status IN ('purchased', 'confirmed', 'cancelled')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS participant_insurances_booking_id_idx ON public.participant_insurances(booking_id);
CREATE INDEX IF NOT EXISTS participant_insurances_participant_id_idx ON public.participant_insurances(participant_id);
CREATE INDEX IF NOT EXISTS participant_insurances_trip_variant_id_idx ON public.participant_insurances(trip_insurance_variant_id);
CREATE INDEX IF NOT EXISTS participant_insurances_purchased_at_idx ON public.participant_insurances(purchased_at);
CREATE INDEX IF NOT EXISTS participant_insurances_status_idx ON public.participant_insurances(status);

ALTER TABLE public.participant_insurances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS participant_insurances_admin_all ON public.participant_insurances;
CREATE POLICY participant_insurances_admin_all
ON public.participant_insurances FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 4. Szablony emaili (3 szablony — po jednym na typ)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.insurance_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type smallint NOT NULL UNIQUE CHECK (type IN (1, 2, 3)),
  subject_template text NOT NULL DEFAULT '',
  body_template text NOT NULL DEFAULT '',
  to_email text NOT NULL DEFAULT '',   -- dla typ 1: adres ubezpieczalni; dla typ 2/3: biuro
  cc_email text,                        -- dla typ 1: adres biura (DW)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_email_templates_admin_all ON public.insurance_email_templates;
CREATE POLICY insurance_email_templates_admin_all
ON public.insurance_email_templates FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 5. Logi wysyłek emaili
-- ============================================================
CREATE TABLE IF NOT EXISTS public.insurance_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  insurance_type smallint NOT NULL CHECK (insurance_type IN (1, 2, 3)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipients text[] NOT NULL DEFAULT '{}',
  xlsx_filename text,
  participants_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'error')),
  error_message text,
  triggered_by text NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_email_logs_trip_id_idx ON public.insurance_email_logs(trip_id);
CREATE INDEX IF NOT EXISTS insurance_email_logs_type_idx ON public.insurance_email_logs(insurance_type);
CREATE INDEX IF NOT EXISTS insurance_email_logs_sent_at_idx ON public.insurance_email_logs(sent_at);

ALTER TABLE public.insurance_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_email_logs_admin_all ON public.insurance_email_logs;
CREATE POLICY insurance_email_logs_admin_all
ON public.insurance_email_logs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 6. Triggery updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_insurance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS insurance_variants_updated_at ON public.insurance_variants;
CREATE TRIGGER insurance_variants_updated_at
BEFORE UPDATE ON public.insurance_variants
FOR EACH ROW EXECUTE FUNCTION public.update_insurance_updated_at();

DROP TRIGGER IF EXISTS trip_insurance_variants_updated_at ON public.trip_insurance_variants;
CREATE TRIGGER trip_insurance_variants_updated_at
BEFORE UPDATE ON public.trip_insurance_variants
FOR EACH ROW EXECUTE FUNCTION public.update_insurance_updated_at();

DROP TRIGGER IF EXISTS participant_insurances_updated_at ON public.participant_insurances;
CREATE TRIGGER participant_insurances_updated_at
BEFORE UPDATE ON public.participant_insurances
FOR EACH ROW EXECUTE FUNCTION public.update_insurance_updated_at();

DROP TRIGGER IF EXISTS insurance_email_templates_updated_at ON public.insurance_email_templates;
CREATE TRIGGER insurance_email_templates_updated_at
BEFORE UPDATE ON public.insurance_email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_insurance_updated_at();

-- ============================================================
-- 7. Seed — globalne warianty domyślne
-- ============================================================

-- Typ 1: Podstawowe (obowiązkowe, PZU)
INSERT INTO public.insurance_variants (type, name, provider, description, is_default, is_active)
VALUES
  (1, 'PZU Wojażer KL 80 000 PLN NNW 10 000 PLN', 'PZU', 'Ubezpieczenie podstawowe — obowiązkowe, wliczone w cenę imprezy', true, true)
ON CONFLICT DO NOTHING;

-- Typ 2: Dodatkowe medyczne (opcjonalne, TU Europa)
INSERT INTO public.insurance_variants (type, name, provider, description, is_default, is_active)
VALUES
  (2, 'Standard Plus KL 50 000 EUR NNW 3 000 EUR, CP, bez OC', 'TU Europa', 'Wariant standardowy', true, true),
  (2, 'VIP KL 150 000 EUR NNW 7 000 EUR, OC, CP', 'TU Europa', 'Wariant VIP', false, true),
  (2, 'The Best KL 500 000 EUR NNW 15 000 EUR, OC, CP', 'TU Europa', 'Wariant premium', false, true)
ON CONFLICT DO NOTHING;

-- Typ 3: Koszty rezygnacji (opcjonalne, TU Europa)
INSERT INTO public.insurance_variants (type, name, provider, description, is_default, is_active)
VALUES
  (3, 'KR Wariant 100%', 'TU Europa', 'Ubezpieczenie kosztów rezygnacji — wariant 100%', true, true),
  (3, 'KR Wariant 100% Max', 'TU Europa', 'Ubezpieczenie kosztów rezygnacji — wariant 100% Max', false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. Seed — domyślne szablony emaili
-- ============================================================
INSERT INTO public.insurance_email_templates (type, subject_template, body_template, to_email, cc_email)
VALUES
  (
    1,
    'Ubezpieczenie, {kraj}, {termin}, #{kod_wycieczki}',
    'Dzień dobry,

proszę o objęcie ubezpieczeniem {wariant_ubezpieczenia}, grupy, wg następującej specyfikacji:

Termin: {termin_od_do}
Kierunek: {kraj}
Liczba osób: {liczba_osob}

W załączeniu lista uczestników.

Z góry dziękuję za potwierdzenie.',
    '',
    ''
  ),
  (
    2,
    'Ubezpieczenie dodatkowe — {kraj}, {termin}, #{kod_wycieczki}',
    'Dzień dobry,

W załączeniu lista uczestników, którzy wykupili dodatkowe ubezpieczenie medyczne na wycieczce:

Wycieczka: {tytul_wycieczki}
Termin: {termin_od_do}
Kierunek: {kraj}
Wariant: {wariant_ubezpieczenia}
Liczba osób: {liczba_osob}

Z poważaniem',
    '',
    NULL
  ),
  (
    3,
    'Raport ubezpieczeń KR — {data_raportu}',
    'Dzień dobry,

W załączeniu raport ubezpieczeń od kosztów rezygnacji zakupionych w dniu {data_poprzedniego_dnia}.

Zestawienie umów:
{lista_umow}

Łączna liczba ubezpieczeń: {liczba_ubezpieczen}

Z poważaniem',
    '',
    NULL
  )
ON CONFLICT (type) DO NOTHING;
