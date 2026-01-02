-- 030: Tabele dla dokumentów zgód (RODO, regulamin, warunki)

-- 1. Utworzenie tabeli global_documents
CREATE TABLE IF NOT EXISTS public.global_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('rodo', 'terms', 'conditions')),
  file_name text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_type)
);

-- 2. Utworzenie tabeli trip_documents
CREATE TABLE IF NOT EXISTS public.trip_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('rodo', 'terms', 'conditions')),
  file_name text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, document_type)
);

-- 3. Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS trip_documents_trip_id_idx ON public.trip_documents(trip_id);
CREATE INDEX IF NOT EXISTS trip_documents_document_type_idx ON public.trip_documents(document_type);
CREATE INDEX IF NOT EXISTS global_documents_document_type_idx ON public.global_documents(document_type);

-- 4. Funkcja do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Triggery dla automatycznej aktualizacji updated_at
DROP TRIGGER IF EXISTS update_global_documents_updated_at ON public.global_documents;
CREATE TRIGGER update_global_documents_updated_at
  BEFORE UPDATE ON public.global_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_documents_updated_at ON public.trip_documents;
CREATE TRIGGER update_trip_documents_updated_at
  BEFORE UPDATE ON public.trip_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Polityki RLS dla global_documents
ALTER TABLE public.global_documents ENABLE ROW LEVEL SECURITY;

-- Odczyt dla wszystkich zalogowanych użytkowników
DROP POLICY IF EXISTS global_documents_read ON public.global_documents;
CREATE POLICY global_documents_read
ON public.global_documents
FOR SELECT
TO authenticated
USING (true);

-- Modyfikacja tylko dla adminów
DROP POLICY IF EXISTS global_documents_admin_all ON public.global_documents;
CREATE POLICY global_documents_admin_all
ON public.global_documents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 7. Polityki RLS dla trip_documents
ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;

-- Odczyt dla wszystkich zalogowanych użytkowników
DROP POLICY IF EXISTS trip_documents_read ON public.trip_documents;
CREATE POLICY trip_documents_read
ON public.trip_documents
FOR SELECT
TO authenticated
USING (true);

-- Modyfikacja tylko dla adminów
-- Uwaga: Sprawdzanie koordynatorów jest realizowane w API endpoints,
-- tutaj upraszczamy politykę RLS, aby nie wymagać istnienia tabeli trip_coordinators
DROP POLICY IF EXISTS trip_documents_admin_all ON public.trip_documents;
CREATE POLICY trip_documents_admin_all
ON public.trip_documents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

