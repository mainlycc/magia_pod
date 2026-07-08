-- Naprawa nieskończonej rekurencji RLS ("stack depth limit exceeded"):
-- polityki na participants/bookings wołają is_admin()/is_coordinator(),
-- które czytają profiles, a polityka profiles_admin_select znów woła is_admin().
-- SECURITY DEFINER omija RLS na profiles i przerywa pętlę.
-- Objaw: koordynator nie widział uczestników, a w logach powtarzał się błąd 54001.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coordinator'
  );
$$;
