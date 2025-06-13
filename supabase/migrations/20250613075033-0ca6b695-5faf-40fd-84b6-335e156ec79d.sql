
-- Fix the ambiguous column reference in the generate_document_number function
CREATE OR REPLACE FUNCTION generate_document_number(
  p_location_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS TEXT AS $$
DECLARE
  house_abbr TEXT;
  next_number INTEGER;
  document_number TEXT;
BEGIN
  -- Pobierz skrót domu dla lokalizacji
  SELECT ls.house_abbreviation INTO house_abbr
  FROM location_settings ls
  WHERE ls.location_id = p_location_id;
  
  -- Jeśli brak skrótu, użyj 'DOM'
  IF house_abbr IS NULL THEN
    house_abbr := 'DOM';
  END IF;
  
  -- Znajdź najwyższy numer dokumentu dla danej lokalizacji, roku i miesiąca
  -- Użyj aliasu tabeli dla wszystkich referencji do kolumn
  SELECT COALESCE(MAX(
    CASE 
      WHEN docs.document_number ~ ('^' || house_abbr || '/' || p_year || '/' || LPAD(p_month::TEXT, 2, '0') || '/[0-9]+$') 
      THEN CAST(SPLIT_PART(docs.document_number, '/', 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_number
  FROM documents docs
  WHERE docs.location_id = p_location_id
    AND EXTRACT(YEAR FROM docs.document_date) = p_year
    AND EXTRACT(MONTH FROM docs.document_date) = p_month;
  
  -- Utwórz numer dokumentu
  document_number := house_abbr || '/' || p_year || '/' || LPAD(p_month::TEXT, 2, '0') || '/' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN document_number;
END;
$$ LANGUAGE plpgsql;
