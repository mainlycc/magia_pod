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
  created_at timestamptz not null default now()
);
create index if not exists trips_slug_idx on public.trips(slug);
alter table public.trips enable row level security;

-- Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  booking_ref text not null unique,
  contact_email text not null,
  contact_phone text,
  address jsonb,
  status text not null check (status in ('pending','confirmed')),
  agreement_pdf_url text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_trip_id_idx on public.bookings(trip_id);
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
create policy trips_public_read_active
on public.trips
for select
to anon, authenticated
using (is_active = true);

-- Modyfikacje tylko dla admina
create policy trips_admin_all
on public.trips
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS: bookings
-- Brak publicznego SELECT
-- Publiczny INSERT (anon) na potrzeby rezerwacji
create policy bookings_public_insert
on public.bookings
for insert
to anon, authenticated
with check (true);

-- Odczyt/zmiana tylko dla admina lub koordynatora przypisanego do wyjazdu
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

create policy bookings_admin_update
on public.bookings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS: participants
-- Publiczny INSERT (anon) na potrzeby rezerwacji
create policy participants_public_insert
on public.participants
for insert
to anon, authenticated
with check (true);

-- Odczyt/zmiana jak w bookings
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

create policy participants_admin_update
on public.participants
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());


