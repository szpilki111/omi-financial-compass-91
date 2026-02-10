
CREATE OR REPLACE FUNCTION public.generate_document_number(p_location_id uuid, p_year integer, p_month integer)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  house_abbr TEXT;
  next_number INTEGER;
  document_number TEXT;
  number_pattern TEXT;
BEGIN
  -- Pobierz skrót domu dla lokalizacji
  SELECT ls.house_abbreviation INTO house_abbr
  FROM location_settings ls
  WHERE ls.location_id = p_location_id;
  
  -- Jeśli brak skrótu, użyj 'DOM'
  IF house_abbr IS NULL THEN
    house_abbr := 'DOM';
  END IF;
  
  -- Wzorzec numeru dokumentu: ABBR/YYYY/MM/NNN
  number_pattern := '^' || house_abbr || '/' || p_year || '/' || LPAD(p_month::TEXT, 2, '0') || '/[0-9]+$';
  
  -- Znajdź najwyższy numer dokumentu dla danej lokalizacji
  -- WAŻNE: szukaj po wzorcu numeru dokumentu, NIE po dacie dokumentu
  -- Zapobiega to duplikatom gdy data dokumentu została zmieniona po utworzeniu
  SELECT COALESCE(MAX(
    CASE 
      WHEN docs.document_number ~ number_pattern
      THEN CAST(SPLIT_PART(docs.document_number, '/', 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_number
  FROM documents docs
  WHERE docs.location_id = p_location_id
    AND docs.document_number ~ number_pattern;
  
  -- Utwórz numer dokumentu
  document_number := house_abbr || '/' || p_year || '/' || LPAD(p_month::TEXT, 2, '0') || '/' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN document_number;
END;
$function$;
