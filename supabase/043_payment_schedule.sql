-- 043: Harmonogram płatności - elastyczny system rat z datami wymagalności

-- Dodanie kolumny payment_schedule do tabeli trips
DO $$
BEGIN
  -- payment_schedule - JSONB z tablicą rat
  -- Format: [{"installment_number": 1, "percent": 30, "due_date": "2024-03-15"}, ...]
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'payment_schedule'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN payment_schedule jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Konwersja istniejących danych z systemu 2-ratowego na nowy format harmonogramu
DO $$
DECLARE
  trip_record RECORD;
  schedule_json jsonb;
  first_percent integer;
  second_percent integer;
  start_date_val date;
  due_date_1 date;
  due_date_2 date;
BEGIN
  -- Dla każdej wycieczki z włączonym podziałem płatności i bez harmonogramu
  FOR trip_record IN
    SELECT 
      id,
      payment_split_enabled,
      payment_split_first_percent,
      payment_split_second_percent,
      start_date
    FROM public.trips
    WHERE payment_split_enabled = true
      AND (payment_schedule IS NULL OR payment_schedule = '[]'::jsonb)
      AND payment_split_first_percent IS NOT NULL
      AND payment_split_second_percent IS NOT NULL
  LOOP
    first_percent := trip_record.payment_split_first_percent;
    second_percent := trip_record.payment_split_second_percent;
    start_date_val := trip_record.start_date;
    
    -- Oblicz daty wymagalności
    -- Zaliczka: 7 dni od teraz (lub jeśli start_date jest w przyszłości, to 7 dni przed start_date)
    IF start_date_val IS NOT NULL AND start_date_val > CURRENT_DATE THEN
      due_date_1 := CURRENT_DATE + INTERVAL '7 days';
      -- Reszta: 14 dni przed start_date
      due_date_2 := start_date_val - INTERVAL '14 days';
    ELSE
      due_date_1 := CURRENT_DATE + INTERVAL '7 days';
      due_date_2 := CURRENT_DATE + INTERVAL '30 days';
    END IF;
    
    -- Utwórz harmonogram z 2 ratami
    schedule_json := jsonb_build_array(
      jsonb_build_object(
        'installment_number', 1,
        'percent', first_percent,
        'due_date', due_date_1::text
      ),
      jsonb_build_object(
        'installment_number', 2,
        'percent', second_percent,
        'due_date', due_date_2::text
      )
    );
    
    -- Zaktualizuj wycieczkę
    UPDATE public.trips
    SET payment_schedule = schedule_json
    WHERE id = trip_record.id;
    
  END LOOP;
  
  -- Dla wycieczek bez podziału płatności, utwórz jedną ratę (100%)
  FOR trip_record IN
    SELECT id, start_date
    FROM public.trips
    WHERE (payment_split_enabled = false OR payment_split_enabled IS NULL)
      AND (payment_schedule IS NULL OR payment_schedule = '[]'::jsonb)
  LOOP
    start_date_val := trip_record.start_date;
    
    -- Data wymagalności: 14 dni przed start_date lub 30 dni od teraz
    IF start_date_val IS NOT NULL AND start_date_val > CURRENT_DATE THEN
      due_date_1 := start_date_val - INTERVAL '14 days';
    ELSE
      due_date_1 := CURRENT_DATE + INTERVAL '30 days';
    END IF;
    
    schedule_json := jsonb_build_array(
      jsonb_build_object(
        'installment_number', 1,
        'percent', 100,
        'due_date', due_date_1::text
      )
    );
    
    UPDATE public.trips
    SET payment_schedule = schedule_json
    WHERE id = trip_record.id;
  END LOOP;
END $$;

-- Dodanie indeksu GIN dla szybkiego wyszukiwania w JSONB
CREATE INDEX IF NOT EXISTS trips_payment_schedule_idx ON public.trips USING GIN (payment_schedule);
