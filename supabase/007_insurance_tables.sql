-- 007: Tabele dla obsługi ubezpieczeń HDI
-- Utworzenie tabel do zarządzania zgłoszeniami ubezpieczeniowymi i konfiguracją integracji

-- Tabela zgłoszeń ubezpieczeniowych
create table if not exists public.insurance_submissions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  participants_count integer not null default 0,
  submission_date timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'error')),
  error_message text,
  api_payload jsonb,
  api_response jsonb,
  policy_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_submissions_trip_id_idx on public.insurance_submissions(trip_id);
create index if not exists insurance_submissions_booking_id_idx on public.insurance_submissions(booking_id);
create index if not exists insurance_submissions_status_idx on public.insurance_submissions(status);
create index if not exists insurance_submissions_submission_date_idx on public.insurance_submissions(submission_date);
alter table public.insurance_submissions enable row level security;

-- Tabela uczestników przypisanych do zgłoszenia
create table if not exists public.insurance_submission_participants (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.insurance_submissions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  hdi_required_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists insurance_submission_participants_submission_id_idx on public.insurance_submission_participants(submission_id);
create index if not exists insurance_submission_participants_participant_id_idx on public.insurance_submission_participants(participant_id);
alter table public.insurance_submission_participants enable row level security;

-- Tabela konfiguracji integracji HDI
create table if not exists public.insurance_config (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'test' check (environment in ('test', 'production')),
  api_key text,
  api_secret text,
  api_url text,
  policy_parameters jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tylko jedna aktywna konfiguracja na środowisko
create unique index if not exists insurance_config_environment_active_idx 
  on public.insurance_config(environment) 
  where is_active = true;

alter table public.insurance_config enable row level security;

-- Funkcja do automatycznej aktualizacji updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggery do aktualizacji updated_at
create trigger insurance_submissions_updated_at
  before update on public.insurance_submissions
  for each row
  execute function public.update_updated_at_column();

create trigger insurance_config_updated_at
  before update on public.insurance_config
  for each row
  execute function public.update_updated_at_column();

-- RLS Policies: insurance_submissions
-- Tylko admin może czytać i modyfikować zgłoszenia
drop policy if exists insurance_submissions_admin_all on public.insurance_submissions;
create policy insurance_submissions_admin_all
on public.insurance_submissions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS Policies: insurance_submission_participants
-- Tylko admin może czytać i modyfikować uczestników zgłoszeń
drop policy if exists insurance_submission_participants_admin_all on public.insurance_submission_participants;
create policy insurance_submission_participants_admin_all
on public.insurance_submission_participants
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS Policies: insurance_config
-- Tylko admin może czytać i modyfikować konfigurację
drop policy if exists insurance_config_admin_all on public.insurance_config;
create policy insurance_config_admin_all
on public.insurance_config
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

