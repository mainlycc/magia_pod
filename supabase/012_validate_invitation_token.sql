-- Migracja: Funkcja do walidacji tokenu zaproszenia (omija RLS)
-- Pozwala niezalogowanym użytkownikom na weryfikację tokenu zaproszenia

-- Funkcja do pobierania zaproszenia przez token (omija RLS)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invitation_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.email,
    ci.status,
    ci.expires_at,
    ci.created_at
  FROM public.coordinator_invitations ci
  WHERE ci.token = invitation_token;
END;
$$;

-- Nadaj uprawnienia do funkcji dla anon i authenticated
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;

