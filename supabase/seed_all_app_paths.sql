-- Seed: dane testowe pokrywające różne ścieżki aplikacji
-- Cel: wycieczki + rezerwacje (pending/confirmed/cancelled) + uczestnicy + płatności (historia, raty) + umowy + faktury + ubezpieczenia (HDI + lokalne)
--
-- Uruchom w Supabase SQL editor lub:
--   supabase db execute --file supabase/seed_all_app_paths.sql

begin;

create extension if not exists "pgcrypto";

-- ============================================================
-- 0) Stałe ID (żeby seed był deterministyczny)
-- ============================================================
-- Trips
--  - TRIP_A: płatność dzielona + harmonogram 2 raty
--  - TRIP_B: płatność 100% (bez split)
--  - TRIP_C: przyszła wycieczka do testów przypomnień i ubezpieczeń
-- Bookings: różne statusy i payment_status
-- Participants: różne dokumenty + selected_services + dane HDI (citizenship/gender)

-- ============================================================
-- 1) Cleanup (tylko rekordy z tego seeda)
--    Kolejność od dzieci do rodziców (FK)
-- ============================================================
do $$
begin
  -- HDI module (opcjonalny)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_submission_participants') then
    delete from public.insurance_submission_participants
    where submission_id in (
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04'
    );
  end if;

  -- Tabela `insurance_logs` jest dopiero po migracji 017_insurance_hdi_enhancements.sql
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_logs') then
    delete from public.insurance_logs
    where submission_id in (
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_submissions') then
    delete from public.insurance_submissions
    where id in (
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04'
    );
  end if;

  -- Local insurance module (opcjonalny)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='participant_insurances') then
    delete from public.participant_insurances
    where booking_id in (
      '22222222-3333-4444-5555-666666666611',
      '22222222-3333-4444-5555-666666666612',
      '22222222-3333-4444-5555-666666666613',
      '22222222-3333-4444-5555-666666666614'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='trip_insurance_variants') then
    delete from public.trip_insurance_variants
    where trip_id in (
      '11111111-2222-3333-4444-555555555511',
      '11111111-2222-3333-4444-555555555512',
      '11111111-2222-3333-4444-555555555513'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_email_logs') then
    delete from public.insurance_email_logs
    where trip_id in (
      '11111111-2222-3333-4444-555555555511',
      '11111111-2222-3333-4444-555555555512',
      '11111111-2222-3333-4444-555555555513'
    );
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='payment_history') then
    delete from public.payment_history
    where booking_id in (
      '22222222-3333-4444-5555-666666666611',
      '22222222-3333-4444-5555-666666666612',
      '22222222-3333-4444-5555-666666666613',
      '22222222-3333-4444-5555-666666666614'
    );
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='agreements') then
    delete from public.agreements
    where booking_id in (
      '22222222-3333-4444-5555-666666666611',
      '22222222-3333-4444-5555-666666666612',
      '22222222-3333-4444-5555-666666666613',
      '22222222-3333-4444-5555-666666666614'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='invoices') then
    delete from public.invoices
    where booking_id in (
      '22222222-3333-4444-5555-666666666611',
      '22222222-3333-4444-5555-666666666612'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='participants') then
    delete from public.participants
    where id in (
      '33333333-4444-5555-6666-777777777711',
      '33333333-4444-5555-6666-777777777712',
      '33333333-4444-5555-6666-777777777713',
      '33333333-4444-5555-6666-777777777714',
      '33333333-4444-5555-6666-777777777715',
      '33333333-4444-5555-6666-777777777716',
      '33333333-4444-5555-6666-777777777717'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='bookings') then
    delete from public.bookings
    where id in (
      '22222222-3333-4444-5555-666666666611',
      '22222222-3333-4444-5555-666666666612',
      '22222222-3333-4444-5555-666666666613',
      '22222222-3333-4444-5555-666666666614'
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='trips') then
    delete from public.trips
    where id in (
      '11111111-2222-3333-4444-555555555511',
      '11111111-2222-3333-4444-555555555512',
      '11111111-2222-3333-4444-555555555513'
    );
  end if;
end $$;

-- ============================================================
-- 2) Trips (różne konfiguracje)
-- ============================================================
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
    '11111111-2222-3333-4444-555555555511',
    'Test: Maroko (split + raty)',
    'test-maroko-split',
    'Wycieczka testowa do sprawdzania rat, umów, ubezpieczeń i płatności.',
    current_date + interval '30 day',
    current_date + interval '37 day',
    649900,
    12,
    0,
    true
  ),
  (
    '11111111-2222-3333-4444-555555555512',
    'Test: City break (100% płatności)',
    'test-citybreak-jedna-rata',
    'Wycieczka testowa bez podziału płatności.',
    current_date + interval '14 day',
    current_date + interval '17 day',
    189900,
    8,
    0,
    true
  ),
  (
    '11111111-2222-3333-4444-555555555513',
    'Test: Islandia (cancel + ubezpieczenia)',
    'test-islandia-cancel',
    'Wycieczka testowa z anulacją i różnymi zgłoszeniami ubezpieczeniowymi.',
    current_date + interval '60 day',
    current_date + interval '69 day',
    799900,
    20,
    0,
    true
  );

-- Ustawienia split/harmonogram/przypomnienia — tylko jeśli kolumny istnieją
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trips' and column_name='payment_split_enabled'
  ) then
    update public.trips
    set payment_split_enabled = true,
        payment_split_first_percent = 30,
        payment_split_second_percent = 70,
        payment_reminder_enabled = true,
        payment_reminder_days_before = 14
    where id = '11111111-2222-3333-4444-555555555511';

    update public.trips
    set payment_split_enabled = false,
        payment_reminder_enabled = false,
        payment_reminder_days_before = null
    where id = '11111111-2222-3333-4444-555555555512';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trips' and column_name='payment_schedule'
  ) then
    -- TRIP_A: 2 raty
    update public.trips
    set payment_schedule = jsonb_build_array(
      jsonb_build_object(
        'installment_number', 1,
        'percent', 30,
        'due_date', (current_date + interval '7 day')::date::text
      ),
      jsonb_build_object(
        'installment_number', 2,
        'percent', 70,
        'due_date', (current_date + interval '20 day')::date::text
      )
    )
    where id = '11111111-2222-3333-4444-555555555511';

    -- TRIP_B: 1 rata 100%
    update public.trips
    set payment_schedule = jsonb_build_array(
      jsonb_build_object(
        'installment_number', 1,
        'percent', 100,
        'due_date', (current_date + interval '10 day')::date::text
      )
    )
    where id = '11111111-2222-3333-4444-555555555512';
  end if;
end $$;

-- ============================================================
-- 3) Bookings (różne ścieżki: pending/confirmed/cancelled + unpaid/partial/paid)
-- ============================================================
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
  created_at
)
values
  (
    '22222222-3333-4444-5555-666666666611',
    '11111111-2222-3333-4444-555555555511',
    'TST-A-0001',
    'ala.test@example.com',
    '+48 500 000 001',
    jsonb_build_object('city', 'Warszawa', 'street', 'Ul. Testowa 1', 'zip', '00-001'),
    jsonb_build_object('rodo', true, 'marketing', false),
    'confirmed',
    'paid',
    timezone('utc', now()) - interval '12 day'
  ),
  (
    '22222222-3333-4444-5555-666666666612',
    '11111111-2222-3333-4444-555555555511',
    'TST-A-0002',
    'bartek.test@example.com',
    '+48 500 000 002',
    jsonb_build_object('city', 'Kraków', 'street', 'Ul. Testowa 2', 'zip', '30-002'),
    jsonb_build_object('rodo', true, 'marketing', true),
    'confirmed',
    'partial',
    timezone('utc', now()) - interval '9 day'
  ),
  (
    '22222222-3333-4444-5555-666666666613',
    '11111111-2222-3333-4444-555555555512',
    'TST-B-0001',
    'celina.test@example.com',
    '+48 500 000 003',
    jsonb_build_object('city', 'Gdańsk', 'street', 'Ul. Testowa 3', 'zip', '80-003'),
    jsonb_build_object('rodo', true, 'marketing', false),
    'pending',
    'unpaid',
    timezone('utc', now()) - interval '2 day'
  ),
  (
    '22222222-3333-4444-5555-666666666614',
    '11111111-2222-3333-4444-555555555513',
    'TST-C-0001',
    'daniel.test@example.com',
    '+48 500 000 004',
    jsonb_build_object('city', 'Wrocław', 'street', 'Ul. Testowa 4', 'zip', '50-004'),
    jsonb_build_object('rodo', true, 'marketing', false),
    'cancelled',
    'unpaid',
    timezone('utc', now()) - interval '20 day'
  );

-- Dodatkowe pola w bookings (raty, paid_amount_cents, access_token, cancelled_at, contact_* itp.)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='paid_amount_cents'
  ) then
    update public.bookings
    set paid_amount_cents = 649900
    where id = '22222222-3333-4444-5555-666666666611';

    update public.bookings
    set paid_amount_cents = 194970
    where id = '22222222-3333-4444-5555-666666666612';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='first_payment_amount_cents'
  ) then
    -- booking 1: obie raty opłacone
    update public.bookings
    set first_payment_amount_cents = 194970,
        second_payment_amount_cents = 454930,
        first_payment_status = 'paid',
        second_payment_status = 'paid',
        reminder_sent_at = timezone('utc', now()) - interval '25 day'
    where id = '22222222-3333-4444-5555-666666666611';

    -- booking 2: tylko zaliczka
    update public.bookings
    set first_payment_amount_cents = 194970,
        second_payment_amount_cents = 454930,
        first_payment_status = 'paid',
        second_payment_status = 'unpaid',
        reminder_sent_at = null
    where id = '22222222-3333-4444-5555-666666666612';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='cancelled_at'
  ) then
    update public.bookings
    set cancelled_at = timezone('utc', now()) - interval '18 day'
    where id = '22222222-3333-4444-5555-666666666614';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='internal_notes'
  ) then
    update public.bookings
    set internal_notes = jsonb_build_array(
      jsonb_build_object('at', (timezone('utc', now()) - interval '8 day'), 'note', 'Klient prosi o fakturę oraz dopisanie do pokoju 2-os.'),
      jsonb_build_object('at', (timezone('utc', now()) - interval '3 day'), 'note', 'Ustalono dopłatę za ubezpieczenie dodatkowe.')
    )
    where id = '22222222-3333-4444-5555-666666666612';
  end if;
end $$;

-- ============================================================
-- 4) Participants (żeby testować przypisywanie płatności i dodatków)
-- ============================================================
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
    '33333333-4444-5555-6666-777777777711',
    '22222222-3333-4444-5555-666666666611',
    'Ala',
    'Kowalska',
    '90010112345',
    'ala.test@example.com',
    '+48 500 000 001',
    'passport',
    'PA0000001',
    jsonb_build_object('city', 'Warszawa', 'street', 'Ul. Testowa 1', 'zip', '00-001'),
    timezone('utc', now()) - interval '12 day'
  ),
  (
    '33333333-4444-5555-6666-777777777712',
    '22222222-3333-4444-5555-666666666611',
    'Olek',
    'Kowalski',
    '92020223456',
    'olek.test@example.com',
    '+48 500 000 011',
    'id_card',
    'ID0000001',
    jsonb_build_object('city', 'Warszawa', 'street', 'Ul. Testowa 1', 'zip', '00-001'),
    timezone('utc', now()) - interval '11 day'
  ),
  (
    '33333333-4444-5555-6666-777777777713',
    '22222222-3333-4444-5555-666666666612',
    'Bartek',
    'Nowak',
    '88030334567',
    'bartek.test@example.com',
    '+48 500 000 002',
    'passport',
    'PB0000002',
    jsonb_build_object('city', 'Kraków', 'street', 'Ul. Testowa 2', 'zip', '30-002'),
    timezone('utc', now()) - interval '9 day'
  ),
  (
    '33333333-4444-5555-6666-777777777714',
    '22222222-3333-4444-5555-666666666612',
    'Iga',
    'Nowak',
    '05040445678',
    'iga.test@example.com',
    '+48 500 000 012',
    'id_card',
    'ID0000002',
    jsonb_build_object('city', 'Kraków', 'street', 'Ul. Testowa 2', 'zip', '30-002'),
    timezone('utc', now()) - interval '8 day'
  ),
  (
    '33333333-4444-5555-6666-777777777715',
    '22222222-3333-4444-5555-666666666613',
    'Celina',
    'Wiśniewska',
    '99050556789',
    'celina.test@example.com',
    '+48 500 000 003',
    'passport',
    'PC0000003',
    jsonb_build_object('city', 'Gdańsk', 'street', 'Ul. Testowa 3', 'zip', '80-003'),
    timezone('utc', now()) - interval '2 day'
  ),
  (
    '33333333-4444-5555-6666-777777777716',
    '22222222-3333-4444-5555-666666666614',
    'Daniel',
    'Zieliński',
    '87060667891',
    'daniel.test@example.com',
    '+48 500 000 004',
    'passport',
    'PD0000004',
    jsonb_build_object('city', 'Wrocław', 'street', 'Ul. Testowa 4', 'zip', '50-004'),
    timezone('utc', now()) - interval '20 day'
  ),
  (
    '33333333-4444-5555-6666-777777777717',
    '22222222-3333-4444-5555-666666666614',
    'Ewa',
    'Zielińska',
    '91070778912',
    'ewa.test@example.com',
    '+48 500 000 014',
    'id_card',
    'ID0000003',
    jsonb_build_object('city', 'Wrocław', 'street', 'Ul. Testowa 4', 'zip', '50-004'),
    timezone('utc', now()) - interval '19 day'
  );

-- selected_services + dane HDI (jeśli kolumny istnieją)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='participants' and column_name='selected_services'
  ) then
    update public.participants
    set selected_services = jsonb_build_object(
      'airport_transfer', true,
      'single_room', false,
      'extra_baggage', true
    )
    where id = '33333333-4444-5555-6666-777777777713';

    update public.participants
    set selected_services = jsonb_build_object(
      'airport_transfer', false,
      'single_room', true,
      'extra_baggage', false
    )
    where id = '33333333-4444-5555-6666-777777777714';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='participants' and column_name='citizenship_code'
  ) then
    update public.participants
    set citizenship_code = 'PL',
        gender_code = 'F'
    where id in ('33333333-4444-5555-6666-777777777711', '33333333-4444-5555-6666-777777777713', '33333333-4444-5555-6666-777777777715');

    update public.participants
    set citizenship_code = 'PL',
        gender_code = 'M'
    where id in ('33333333-4444-5555-6666-777777777712', '33333333-4444-5555-6666-777777777716');
  end if;
end $$;

-- ============================================================
-- 5) payment_history (żeby testować dodawanie wpłat)
-- ============================================================
insert into public.payment_history (
  id,
  booking_id,
  amount_cents,
  payment_date,
  payment_method,
  notes,
  created_at
)
values
  (
    '44444444-5555-6666-7777-888888888801',
    '22222222-3333-4444-5555-666666666611',
    194970,
    current_date - 20,
    'manual',
    'Zaliczka zaksięgowana ręcznie',
    timezone('utc', now()) - interval '20 day'
  ),
  (
    '44444444-5555-6666-7777-888888888802',
    '22222222-3333-4444-5555-666666666611',
    454930,
    current_date - 10,
    'paynow',
    'Dopłata przez Paynow',
    timezone('utc', now()) - interval '10 day'
  ),
  (
    '44444444-5555-6666-7777-888888888803',
    '22222222-3333-4444-5555-666666666612',
    194970,
    current_date - 8,
    'bank_transfer',
    'Tylko zaliczka (brak dopłaty)',
    timezone('utc', now()) - interval '8 day'
  );

-- ============================================================
-- 6) agreements (generated/sent/signed)
-- ============================================================
insert into public.agreements (
  id,
  booking_id,
  template_id,
  status,
  pdf_url,
  sent_at,
  signed_at,
  created_at,
  updated_at
)
values
  (
    '55555555-6666-7777-8888-999999999901',
    '22222222-3333-4444-5555-666666666611',
    'default',
    'signed',
    'https://example.com/agreement/TST-A-0001.pdf',
    timezone('utc', now()) - interval '11 day',
    timezone('utc', now()) - interval '10 day',
    timezone('utc', now()) - interval '12 day',
    timezone('utc', now()) - interval '10 day'
  ),
  (
    '55555555-6666-7777-8888-999999999902',
    '22222222-3333-4444-5555-666666666612',
    'default',
    'sent',
    'https://example.com/agreement/TST-A-0002.pdf',
    timezone('utc', now()) - interval '8 day',
    null,
    timezone('utc', now()) - interval '9 day',
    timezone('utc', now()) - interval '8 day'
  ),
  (
    '55555555-6666-7777-8888-999999999903',
    '22222222-3333-4444-5555-666666666613',
    'default',
    'generated',
    null,
    null,
    null,
    timezone('utc', now()) - interval '2 day',
    timezone('utc', now()) - interval '2 day'
  );

-- agreements.generated_at / agreement_seq — jeśli istnieją
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='agreements' and column_name='generated_at'
  ) then
    update public.agreements
    set generated_at = created_at
    where id in (
      '55555555-6666-7777-8888-999999999901',
      '55555555-6666-7777-8888-999999999902',
      '55555555-6666-7777-8888-999999999903'
    );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='agreements' and column_name='agreement_seq'
  ) then
    update public.agreements set agreement_seq = 1 where id = '55555555-6666-7777-8888-999999999901';
    update public.agreements set agreement_seq = 2 where id = '55555555-6666-7777-8888-999999999902';
    update public.agreements set agreement_seq = 1 where id = '55555555-6666-7777-8888-999999999903';
  end if;
end $$;

-- ============================================================
-- 7) invoices (różne statusy)
-- ============================================================
insert into public.invoices (
  id,
  booking_id,
  invoice_number,
  amount_cents,
  status,
  created_at,
  updated_at
)
values
  (
    '66666666-7777-8888-9999-000000000001',
    '22222222-3333-4444-5555-666666666611',
    'FV/' || to_char(now(), 'YYYY') || '/901',
    649900,
    'opłacona',
    timezone('utc', now()) - interval '10 day',
    timezone('utc', now()) - interval '10 day'
  ),
  (
    '66666666-7777-8888-9999-000000000002',
    '22222222-3333-4444-5555-666666666612',
    'FV/' || to_char(now(), 'YYYY') || '/902',
    649900,
    'wystawiona',
    timezone('utc', now()) - interval '8 day',
    timezone('utc', now()) - interval '8 day'
  );

-- ============================================================
-- 8) Ubezpieczenia lokalne (warianty na wycieczce + zakup uczestników)
-- ============================================================
-- Trip insurance variants: użyj istniejących insurance_variants (seed z migracji 051)
do $$
declare
  v_var1 uuid;
  v_var2 uuid;
  v_var3 uuid;
  v_trip_var1 uuid;
  v_trip_var2 uuid;
  v_trip_var3 uuid;
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_variants')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='trip_insurance_variants')
  then
    select id into v_var1 from public.insurance_variants where type = 1 and is_active = true order by is_default desc, created_at asc limit 1;
    select id into v_var2 from public.insurance_variants where type = 2 and is_active = true order by is_default desc, created_at asc limit 1;
    select id into v_var3 from public.insurance_variants where type = 3 and is_active = true order by is_default desc, created_at asc limit 1;

    -- TRIP_A: włączone typ 1 + 2 + 3
    insert into public.trip_insurance_variants (id, trip_id, variant_id, price_grosz, is_enabled)
    values
      ('77777777-8888-9999-0000-000000000011', '11111111-2222-3333-4444-555555555511', v_var1, null, true),
      ('77777777-8888-9999-0000-000000000012', '11111111-2222-3333-4444-555555555511', v_var2, 9900, true),
      ('77777777-8888-9999-0000-000000000013', '11111111-2222-3333-4444-555555555511', v_var3, 12900, true);

    -- TRIP_C: włączone typ 1, wyłączone typ 2, włączone typ 3
    insert into public.trip_insurance_variants (id, trip_id, variant_id, price_grosz, is_enabled)
    values
      ('77777777-8888-9999-0000-000000000021', '11111111-2222-3333-4444-555555555513', v_var1, null, true),
      ('77777777-8888-9999-0000-000000000022', '11111111-2222-3333-4444-555555555513', v_var2, 11900, false),
      ('77777777-8888-9999-0000-000000000023', '11111111-2222-3333-4444-555555555513', v_var3, 15900, true);

    -- Zakupy uczestników (różne statusy)
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='participant_insurances') then
      -- participant 713 kupuje typ 2 (purchased)
      insert into public.participant_insurances (id, booking_id, participant_id, trip_insurance_variant_id, status, purchased_at)
      values
        ('88888888-9999-0000-1111-000000000001', '22222222-3333-4444-5555-666666666612', '33333333-4444-5555-6666-777777777713', '77777777-8888-9999-0000-000000000012', 'purchased', timezone('utc', now()) - interval '7 day');

      -- participant 714 ma typ 3 potwierdzony (confirmed)
      insert into public.participant_insurances (id, booking_id, participant_id, trip_insurance_variant_id, status, purchased_at)
      values
        ('88888888-9999-0000-1111-000000000002', '22222222-3333-4444-5555-666666666612', '33333333-4444-5555-6666-777777777714', '77777777-8888-9999-0000-000000000013', 'confirmed', timezone('utc', now()) - interval '6 day');

      -- participant 716 anulowane (cancelled) na TRIP_C
      insert into public.participant_insurances (id, booking_id, participant_id, trip_insurance_variant_id, status, purchased_at)
      values
        ('88888888-9999-0000-1111-000000000003', '22222222-3333-4444-5555-666666666614', '33333333-4444-5555-6666-777777777716', '77777777-8888-9999-0000-000000000023', 'cancelled', timezone('utc', now()) - interval '17 day');
    end if;

    -- Logi maili (sent/error)
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_email_logs') then
      insert into public.insurance_email_logs (id, trip_id, insurance_type, recipients, xlsx_filename, participants_count, status, triggered_by, sent_at)
      values
        ('99999999-0000-1111-2222-000000000001', '11111111-2222-3333-4444-555555555511', 2, array['biuro@example.com'], 'ubezpieczenia_typ2.xlsx', 2, 'sent', 'manual', timezone('utc', now()) - interval '5 day'),
        ('99999999-0000-1111-2222-000000000002', '11111111-2222-3333-4444-555555555513', 3, array['biuro@example.com'], 'ubezpieczenia_typ3.xlsx', 1, 'error', 'cron', timezone('utc', now()) - interval '2 day');
    end if;
  end if;
end $$;

-- ============================================================
-- 9) Ubezpieczenia HDI (insurance_submissions + participants + logs)
-- ============================================================
do $$
declare
  v_constraint_def text;
  v_extended_statuses boolean := false;
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_submissions')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_submission_participants')
  then
    -- W zależności od uruchomionych migracji, constraint na insurance_submissions.status może być:
    -- 007: ('pending','sent','accepted','error')
    -- 017: rozszerzony m.in. o 'manual_check_required'
    select pg_get_constraintdef(c.oid)
    into v_constraint_def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'insurance_submissions'
      and c.contype = 'c'
      and c.conname = 'insurance_submissions_status_check'
    limit 1;

    v_extended_statuses := (v_constraint_def is not null and position('manual_check_required' in v_constraint_def) > 0);

    -- 4 zgłoszenia w różnych statusach (żeby testować ścieżki)
    insert into public.insurance_submissions (
      id, trip_id, booking_id, participants_count, submission_date, status, error_message,
      api_payload, api_response, policy_number, created_at, updated_at
    )
    values
      (
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
        '11111111-2222-3333-4444-555555555511',
        '22222222-3333-4444-5555-666666666611',
        2,
        timezone('utc', now()) - interval '9 day',
        'pending',
        null,
        jsonb_build_object('scenario', 'pending', 'trip', 'TRIP_A'),
        null,
        null,
        timezone('utc', now()) - interval '9 day',
        timezone('utc', now()) - interval '9 day'
      ),
      (
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
        '11111111-2222-3333-4444-555555555511',
        '22222222-3333-4444-5555-666666666612',
        2,
        timezone('utc', now()) - interval '8 day',
        'sent',
        null,
        jsonb_build_object('scenario', 'sent'),
        jsonb_build_object('ok', true),
        'HDI-TEST-0002',
        timezone('utc', now()) - interval '8 day',
        timezone('utc', now()) - interval '8 day'
      ),
      (
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03',
        '11111111-2222-3333-4444-555555555513',
        '22222222-3333-4444-5555-666666666614',
        2,
        timezone('utc', now()) - interval '18 day',
        'error',
        'Błąd testowy integracji',
        jsonb_build_object('scenario', 'error'),
        jsonb_build_object('error', 'TEST_ERROR'),
        null,
        timezone('utc', now()) - interval '18 day',
        timezone('utc', now()) - interval '18 day'
      ),
      (
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04',
        '11111111-2222-3333-4444-555555555513',
        null,
        0,
        timezone('utc', now()) - interval '1 day',
        case when v_extended_statuses then 'manual_check_required' else 'pending' end,
        'Wymagana ręczna weryfikacja',
        jsonb_build_object('scenario', 'manual_check_required'),
        null,
        null,
        timezone('utc', now()) - interval '1 day',
        timezone('utc', now()) - interval '1 day'
      );

    -- Uczestnicy przypisani do zgłoszeń
    insert into public.insurance_submission_participants (
      id, submission_id, participant_id, hdi_required_data, created_at
    )
    values
      (
        'bbbbbbbb-cccc-dddd-eeee-fffffffff001',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
        '33333333-4444-5555-6666-777777777711',
        jsonb_build_object('birthDate', '1990-01-01', 'docType', 'passport'),
        timezone('utc', now()) - interval '9 day'
      ),
      (
        'bbbbbbbb-cccc-dddd-eeee-fffffffff002',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
        '33333333-4444-5555-6666-777777777712',
        jsonb_build_object('birthDate', '1992-02-02', 'docType', 'id_card'),
        timezone('utc', now()) - interval '9 day'
      ),
      (
        'bbbbbbbb-cccc-dddd-eeee-fffffffff003',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
        '33333333-4444-5555-6666-777777777713',
        jsonb_build_object('birthDate', '1988-03-03', 'docType', 'passport'),
        timezone('utc', now()) - interval '8 day'
      ),
      (
        'bbbbbbbb-cccc-dddd-eeee-fffffffff004',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
        '33333333-4444-5555-6666-777777777714',
        jsonb_build_object('birthDate', '2005-04-04', 'docType', 'id_card'),
        timezone('utc', now()) - interval '8 day'
      );

    -- Logi operacji (success/error) — tylko jeśli tabela istnieje (017)
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='insurance_logs') then
      insert into public.insurance_logs (id, submission_id, operation_type, status, request_payload, response_payload, error_code, error_message, created_at)
      values
        ('cccccccc-dddd-eeee-ffff-000000000001', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02', 'register', 'success', jsonb_build_object('req', 1), jsonb_build_object('res', 1), null, null, timezone('utc', now()) - interval '8 day'),
        ('cccccccc-dddd-eeee-ffff-000000000002', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03', 'register', 'error', jsonb_build_object('req', 2), jsonb_build_object('res', 2), 'TEST', 'Błąd testowy', timezone('utc', now()) - interval '18 day');
    end if;
  end if;
end $$;

-- ============================================================
-- 10) seats_reserved = liczba uczestników
-- ============================================================
update public.trips t
set seats_reserved = coalesce((
  select count(*)
  from public.bookings b
  join public.participants p on p.booking_id = b.id
  where b.trip_id = t.id
), 0)
where t.id in (
  '11111111-2222-3333-4444-555555555511',
  '11111111-2222-3333-4444-555555555512',
  '11111111-2222-3333-4444-555555555513'
);

commit;

