-- 021: Tabela szablonów wiadomości
-- Utworzenie tabeli do zarządzania szablonami wiadomości grupowych

-- 1. Utworzenie tabeli message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indeksy
CREATE INDEX IF NOT EXISTS message_templates_created_at_idx ON public.message_templates(created_at);
CREATE INDEX IF NOT EXISTS message_templates_updated_at_idx ON public.message_templates(updated_at);

-- 3. Włączenie RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - tylko admini mają dostęp
DROP POLICY IF EXISTS message_templates_admin_all ON public.message_templates;
CREATE POLICY message_templates_admin_all
ON public.message_templates
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Funkcja do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.update_message_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. Trigger do aktualizacji updated_at
DROP TRIGGER IF EXISTS message_templates_updated_at_trigger ON public.message_templates;
CREATE TRIGGER message_templates_updated_at_trigger
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_message_templates_updated_at();

