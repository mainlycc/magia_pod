-- Sample data for testing the admin bookings view and manual payment statuses.
-- Run this in Supabase SQL editor or via `supabase db execute`.

begin;

create extension if not exists "pgcrypto";

-- Trips ---------------------------------------------------------------------
insert into public.trips (
  id,
  title,
  slug,
  description,
  start_date,
  end_date,
  price_cents,
  seats_total,
  seats_reserved,
  is_active
)
values
  (
    '11111111-2222-3333-4444-555555555501',
    'Islandia: Polowanie na Zorzę',
    'islandia-zorza-2025',
    'Wyjazd z przewodnikiem, noclegi w Reykjaviku i objazd Złotego Kręgu.',
    '2025-03-10',
    '2025-03-18',
    549900,
    20,
    6,
    true
  ),
  (
    '11111111-2222-3333-4444-555555555502',
    'Lazurowe Wybrzeże: Majówka',
    'lazurowe-wybrzeze-2025',
    'Relaks na południu Francji, w programie Nicea, Monaco, Cannes.',
    '2025-05-01',
    '2025-05-06',
    329900,
    30,
    2,
    true
  )
on conflict (id) do nothing;

-- Bookings ------------------------------------------------------------------
insert into public.bookings (
  id,
  trip_id,
  booking_ref,
  contact_email,
  contact_phone,
  address,
  consents,
  status,
  payment_status,
  agreement_pdf_url,
  created_at
)
values
  (
    '22222222-3333-4444-5555-666666666601',
    '11111111-2222-3333-4444-555555555501',
    'ISL-2025-0001',
    'anna.kowalska@example.com',
    '+48 500 100 200',
    jsonb_build_object('city', 'Warszawa', 'street', 'Ul. Zielna 7/4', 'zip', '00-108'),
    jsonb_build_object('rodo', true, 'marketing', false),
    'confirmed',
    'paid',
    null,
    timezone('utc', now()) - interval '10 day'
  ),
  (
    '22222222-3333-4444-5555-666666666602',
    '11111111-2222-3333-4444-555555555501',
    'ISL-2025-0002',
    'piotr.nowak@example.com',
    '+48 600 200 300',
    jsonb_build_object('city', 'Kraków', 'street', 'Ul. Floriańska 12', 'zip', '31-021'),
    jsonb_build_object('rodo', true, 'marketing', true),
    'confirmed',
    'partial',
    null,
    timezone('utc', now()) - interval '7 day'
  ),
  (
    '22222222-3333-4444-5555-666666666603',
    '11111111-2222-3333-4444-555555555502',
    'AZU-2025-0001',
    'justyna.malinowska@example.com',
    '+48 790 300 400',
    jsonb_build_object('city', 'Poznań', 'street', 'Ul. Święty Marcin 45', 'zip', '61-806'),
    jsonb_build_object('rodo', true, 'marketing', false),
    'confirmed',
    'unpaid',
    null,
    timezone('utc', now()) - interval '5 day'
  )
on conflict (id) do nothing;

-- Participants --------------------------------------------------------------
insert into public.participants (
  id,
  booking_id,
  first_name,
  last_name,
  pesel,
  email,
  phone,
  document_type,
  document_number,
  address,
  created_at
)
values
  (
    '33333333-4444-5555-6666-777777777701',
    '22222222-3333-4444-5555-666666666601',
    'Anna',
    'Kowalska',
    '82031212345',
    'anna.kowalska@example.com',
    '+48 500 100 200',
    'passport',
    'PG1234567',
    jsonb_build_object('city', 'Warszawa', 'street', 'Ul. Zielna 7/4', 'zip', '00-108'),
    timezone('utc', now()) - interval '10 day'
  ),
  (
    '33333333-4444-5555-6666-777777777702',
    '22222222-3333-4444-5555-666666666601',
    'Marek',
    'Kowalski',
    '78072154321',
    'marek.kowalski@example.com',
    '+48 500 100 201',
    'passport',
    'PG7654321',
    jsonb_build_object('city', 'Warszawa', 'street', 'Ul. Zielna 7/4', 'zip', '00-108'),
    timezone('utc', now()) - interval '9 day'
  ),
  (
    '33333333-4444-5555-6666-777777777703',
    '22222222-3333-4444-5555-666666666602',
    'Piotr',
    'Nowak',
    '90010467891',
    'piotr.nowak@example.com',
    '+48 600 200 300',
    'id_card',
    'ABA123456',
    jsonb_build_object('city', 'Kraków', 'street', 'Ul. Floriańska 12', 'zip', '31-021'),
    timezone('utc', now()) - interval '7 day'
  ),
  (
    '33333333-4444-5555-6666-777777777704',
    '22222222-3333-4444-5555-666666666602',
    'Julia',
    'Nowak',
    '12021598765',
    'julia.nowak@example.com',
    '+48 600 200 301',
    'id_card',
    'ABA654321',
    jsonb_build_object('city', 'Kraków', 'street', 'Ul. Floriańska 12', 'zip', '31-021'),
    timezone('utc', now()) - interval '6 day'
  ),
  (
    '33333333-4444-5555-6666-777777777705',
    '22222222-3333-4444-5555-666666666603',
    'Justyna',
    'Malinowska',
    '85092424680',
    'justyna.malinowska@example.com',
    '+48 790 300 400',
    'passport',
    'PL9900887',
    jsonb_build_object('city', 'Poznań', 'street', 'Ul. Święty Marcin 45', 'zip', '61-806'),
    timezone('utc', now()) - interval '5 day'
  ),
  (
    '33333333-4444-5555-6666-777777777706',
    '22222222-3333-4444-5555-666666666603',
    'Karol',
    'Malinowski',
    '89010246851',
    'karol.malinowski@example.com',
    '+48 790 300 401',
    'passport',
    'PL8800776',
    jsonb_build_object('city', 'Poznań', 'street', 'Ul. Święty Marcin 45', 'zip', '61-806'),
    timezone('utc', now()) - interval '5 day'
  )
on conflict (id) do nothing;

-- Synchronise seats_reserved with actual participants count -----------------
update public.trips t
set seats_reserved = coalesce((
  select count(*)
  from public.bookings b
  join public.participants p on p.booking_id = b.id
  where b.trip_id = t.id
), 0)
where t.id in (
  '11111111-2222-3333-4444-555555555501',
  '11111111-2222-3333-4444-555555555502'
);

commit;

