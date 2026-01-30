-- 041: Rozszerzenie typów dokumentów o nowe typy zgodnie z wymaganiami prawnymi

-- 1. Rozszerzenie CHECK constraint dla global_documents
ALTER TABLE public.global_documents
DROP CONSTRAINT IF EXISTS global_documents_document_type_check;

ALTER TABLE public.global_documents
ADD CONSTRAINT global_documents_document_type_check 
CHECK (document_type IN (
  'rodo', 
  'terms', 
  'conditions',
  'agreement',
  'conditions_de_pl',
  'standard_form',
  'electronic_services',
  'rodo_info',
  'insurance_terms'
));

-- 2. Rozszerzenie CHECK constraint dla trip_documents
ALTER TABLE public.trip_documents
DROP CONSTRAINT IF EXISTS trip_documents_document_type_check;

ALTER TABLE public.trip_documents
ADD CONSTRAINT trip_documents_document_type_check 
CHECK (document_type IN (
  'rodo', 
  'terms', 
  'conditions',
  'agreement',
  'conditions_de_pl',
  'standard_form',
  'electronic_services',
  'rodo_info',
  'insurance_terms'
));
