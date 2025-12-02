-- 008: Dodanie zaplanowanego wyjazdu do funkcji get_participants_overview
-- Aktualizacja funkcji, aby zwracała najbliższy przyszły wyjazd dla uczestnika

-- Usuń starą funkcję, ponieważ zmieniamy typ zwracany
drop function if exists public.get_participants_overview();

create function public.get_participants_overview()
returns table (
  id uuid,
  first_name text,
  last_name text,
  pesel text,
  birth_date date,
  notes text,
  group_name text,
  trips_count integer,
  last_trip_title text,
  last_trip_start date,
  last_trip_end date,
  upcoming_trip_title text,
  upcoming_trip_start date,
  upcoming_trip_end date
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with all_trips as (
    select
      p.id as participant_id,
      t.id as trip_id,
      t.title,
      t.start_date,
      t.end_date
    from public.participants p
    left join public.bookings b on b.id = p.booking_id
    left join public.trips t on t.id = b.trip_id
    where t.id is not null
  ),
  last_trips as (
    select distinct on (participant_id)
      participant_id,
      trip_id,
      title as last_trip_title,
      start_date as last_trip_start,
      end_date as last_trip_end
    from all_trips
    order by participant_id, start_date desc nulls last
  ),
  upcoming_trips as (
    select distinct on (participant_id)
      participant_id,
      trip_id,
      title as upcoming_trip_title,
      start_date as upcoming_trip_start,
      end_date as upcoming_trip_end
    from all_trips
    where start_date >= current_date
    order by participant_id, start_date asc nulls last
  )
  select
    p.id,
    p.first_name,
    p.last_name,
    p.pesel,
    p.birth_date,
    p.notes,
    p.group_name,
    count(distinct at.trip_id)::integer as trips_count,
    lt.last_trip_title,
    lt.last_trip_start,
    lt.last_trip_end,
    ut.upcoming_trip_title,
    ut.upcoming_trip_start,
    ut.upcoming_trip_end
  from public.participants p
  left join all_trips at on at.participant_id = p.id
  left join last_trips lt on lt.participant_id = p.id
  left join upcoming_trips ut on ut.participant_id = p.id
  group by
    p.id,
    p.first_name,
    p.last_name,
    p.pesel,
    p.birth_date,
    p.notes,
    p.group_name,
    lt.last_trip_title,
    lt.last_trip_start,
    lt.last_trip_end,
    ut.upcoming_trip_title,
    ut.upcoming_trip_start,
    ut.upcoming_trip_end;
$$;

grant execute on function public.get_participants_overview() to authenticated;

