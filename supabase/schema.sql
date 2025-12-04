-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Profiles (role + whitelista wyjazdów dla koordynatorów)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','coordinator')),
  allowed_trip_ids uuid[] default null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Polityki RLS dla profiles
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Admin może czytać wszystkie profile
drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select
on public.profiles
for select
to authenticated
using (public.is_admin());

-- Admin może aktualizować allowed_trip_ids dla koordynatorów
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and (
    -- Można aktualizować tylko koordynatorów
    (select role from public.profiles where id = profiles.id) = 'coordinator'
    -- Lub aktualizować swój własny profil (na wszelki wypadek)
    or profiles.id = auth.uid()
  )
);

-- Helpery ról
create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_coordinator() returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coordinator'
  );
$$;

-- Trips (publicznie widoczne tylko aktywne)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  start_date date,
  end_date date,
  price_cents integer,
  seats_total integer not null default 0,
  seats_reserved integer not null default 0,
  is_active boolean not null default true,
  gallery_urls jsonb not null default '[]'::jsonb,
  category text,
  location text,
  created_at timestamptz not null default now()
);
create index if not exists trips_slug_idx on public.trips(slug);
alter table public.trips enable row level security;

-- Funkcje pomocnicze do rezerwacji miejsc
create or replace function public.reserve_trip_seats(p_trip_id uuid, p_requested integer)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_record public.trips;
begin
  if p_requested is null or p_requested <= 0 then
    return null;
  end if;

  update public.trips
     set seats_reserved = seats_reserved + p_requested
   where id = p_trip_id
     and is_active = true
     and seats_total - seats_reserved >= p_requested
  returning * into updated_record;

  return updated_record;
end;
$$;

create or replace function public.release_trip_seats(p_trip_id uuid, p_requested integer)
returns public.trips
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_record public.trips;
begin
  if p_requested is null or p_requested <= 0 then
    return null;
  end if;

  update public.trips
     set seats_reserved = greatest(seats_reserved - p_requested, 0)
   where id = p_trip_id
  returning * into updated_record;

  return updated_record;
end;
$$;

grant execute on function public.reserve_trip_seats(uuid, integer) to anon, authenticated;
grant execute on function public.release_trip_seats(uuid, integer) to anon, authenticated;

-- Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  booking_ref text not null unique,
  contact_email text not null,
  contact_phone text,
  address jsonb,
  consents jsonb default '{}'::jsonb,
  status text not null check (status in ('pending','confirmed')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','overpaid')),
  agreement_pdf_url text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_trip_id_idx on public.bookings(trip_id);
create index if not exists bookings_booking_ref_idx on public.bookings(booking_ref);
alter table public.bookings enable row level security;

-- Participants
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  pesel text not null,
  email text,
  phone text,
  document_type text,
  document_number text,
  address jsonb,
  created_at timestamptz not null default now()
);
create index if not exists participants_booking_id_idx on public.participants(booking_id);
alter table public.participants enable row level security;

-- RLS: trips
-- Publiczny odczyt TYLKO aktywnych
drop policy if exists trips_public_read_active on public.trips;
create policy trips_public_read_active
on public.trips
for select
to anon, authenticated
using (is_active = true);

-- Modyfikacje tylko dla admina
drop policy if exists trips_admin_all on public.trips;
create policy trips_admin_all
on public.trips
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS: bookings
-- Brak publicznego SELECT
-- Publiczny INSERT (anon) na potrzeby rezerwacji
drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert
on public.bookings
for insert
to anon, authenticated
with check (true);

-- Odczyt/zmiana tylko dla admina lub koordynatora przypisanego do wyjazdu
drop policy if exists bookings_admin_read on public.bookings;
create policy bookings_admin_read
on public.bookings
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_coordinator()
    and exists (
      select 1
      from public.profiles pr
      join public.trips t on t.id = bookings.trip_id
      where pr.id = auth.uid()
        and pr.role = 'coordinator'
        and pr.allowed_trip_ids is not null
        and t.id = any(pr.allowed_trip_ids)
    )
  )
);

drop policy if exists bookings_admin_update on public.bookings;
create policy bookings_admin_update
on public.bookings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS: participants
-- Publiczny INSERT (anon) na potrzeby rezerwacji
drop policy if exists participants_public_insert on public.participants;
create policy participants_public_insert
on public.participants
for insert
to anon, authenticated
with check (true);

-- Odczyt/zmiana jak w bookings
drop policy if exists participants_admin_read on public.participants;
create policy participants_admin_read
on public.participants
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_coordinator()
    and exists (
      select 1
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      join public.profiles pr on pr.id = auth.uid()
      where participants.booking_id = b.id
        and pr.role = 'coordinator'
        and pr.allowed_trip_ids is not null
        and t.id = any(pr.allowed_trip_ids)
    )
  )
);

drop policy if exists participants_admin_update on public.participants;
create policy participants_admin_update
on public.participants
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Coordinator Invitations
create table if not exists public.coordinator_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coordinator_invitations_email_idx on public.coordinator_invitations(email);
create index if not exists coordinator_invitations_status_idx on public.coordinator_invitations(status);
create index if not exists coordinator_invitations_token_idx on public.coordinator_invitations(token);
alter table public.coordinator_invitations enable row level security;

-- RLS: coordinator_invitations
drop policy if exists coordinator_invitations_admin_all on public.coordinator_invitations;
create policy coordinator_invitations_admin_all
on public.coordinator_invitations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Funkcja do automatycznego wygaszania starych zaproszeń
create or replace function public.expire_old_invitations()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.coordinator_invitations
  set status = 'expired',
      updated_at = now()
  where status = 'pending'
    and expires_at < now();
end;
$$;

-- Funkcja do akceptacji zaproszenia przez token (omija RLS)
create or replace function public.accept_invitation_by_token(invitation_token uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.coordinator_invitations
  set status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  where token = invitation_token
    and status = 'pending'
    and expires_at >= now();
end;
$$;

-- Funkcja do pobierania zaproszenia przez token (omija RLS)
create or replace function public.get_invitation_by_token(invitation_token uuid)
returns table (
  id uuid,
  email text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select 
    ci.id,
    ci.email,
    ci.status,
    ci.expires_at,
    ci.created_at
  from public.coordinator_invitations ci
  where ci.token = invitation_token;
end;
$$;

grant execute on function public.expire_old_invitations() to authenticated;
grant execute on function public.accept_invitation_by_token(uuid) to anon, authenticated;
grant execute on function public.get_invitation_by_token(uuid) to anon, authenticated;


