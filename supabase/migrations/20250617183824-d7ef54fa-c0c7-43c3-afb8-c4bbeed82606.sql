
-- Funkcja sprawdzająca czy istnieje złożony lub zatwierdzony raport dla danego okresu i lokalizacji
CREATE OR REPLACE FUNCTION public.check_report_editing_blocked(
  p_location_id uuid,
  p_document_date date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  report_exists boolean := false;
BEGIN
  -- Sprawdź czy istnieje raport o statusie 'submitted' lub 'approved' 
  -- dla danej lokalizacji i okresu (rok/miesiąc) dokumentu
  SELECT EXISTS(
    SELECT 1 
    FROM reports 
    WHERE location_id = p_location_id
      AND year = EXTRACT(YEAR FROM p_document_date)
      AND month = EXTRACT(MONTH FROM p_document_date)
      AND status IN ('submitted', 'approved')
  ) INTO report_exists;
  
  RETURN report_exists;
END;
$$;
