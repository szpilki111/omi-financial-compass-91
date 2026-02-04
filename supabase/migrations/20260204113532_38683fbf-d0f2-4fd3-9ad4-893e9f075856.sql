-- Problem 2: Blokada dokumentów gdy istnieje raport roboczy (draft)
CREATE OR REPLACE FUNCTION public.check_report_editing_blocked(p_location_id uuid, p_document_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  report_exists boolean := false;
BEGIN
  -- Sprawdź czy istnieje raport o statusie 'draft', 'submitted' lub 'approved' 
  -- dla danej lokalizacji i okresu (rok/miesiąc) dokumentu
  SELECT EXISTS(
    SELECT 1 
    FROM reports 
    WHERE location_id = p_location_id
      AND year = EXTRACT(YEAR FROM p_document_date)
      AND month = EXTRACT(MONTH FROM p_document_date)
      AND status IN ('draft', 'submitted', 'approved')  -- Dodano 'draft'
  ) INTO report_exists;
  
  RETURN report_exists;
END;
$function$;

-- Problem 4: Napraw ograniczenia kont - dodaj filtrowanie po account_category_restrictions
CREATE OR REPLACE FUNCTION public.get_user_filtered_accounts_with_analytics(p_user_id uuid, p_include_inactive boolean DEFAULT false, p_skip_restrictions boolean DEFAULT false)
RETURNS TABLE(id uuid, number text, name text, type text, is_active boolean, analytical boolean, has_analytics boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role text;
  v_location_ids uuid[];
  v_location_identifiers text[];
  v_category_prefixes text[];
  v_restricted_prefixes text[];
BEGIN
  -- Pobierz rolę użytkownika
  SELECT p.role INTO v_user_role
  FROM profiles p
  WHERE p.id = p_user_id;

  -- Dla adminów i prowincjałów zwróć wszystkie konta - ZOPTYMALIZOWANE
  IF v_user_role IN ('admin', 'prowincjal') OR p_skip_restrictions THEN
    -- Najpierw oblicz has_analytics jednym zapytaniem i cache w CTE
    RETURN QUERY
    WITH parent_accounts AS (
      -- Znajdź wszystkie konta które mają podkonta (są prefiksem innego konta)
      SELECT DISTINCT split_part(a.number, '-', 1) || '-' || split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) as parent_prefix
      FROM accounts a
      WHERE a.number LIKE '%-%-%-%' -- Ma co najmniej 4 segmenty = jest podkontem
        AND a.is_active = true
    )
    SELECT 
      a.id,
      a.number,
      a.name,
      a.type,
      a.is_active,
      a.analytical,
      -- Sprawdź czy jakiekolwiek konto zaczyna się od tego numeru + "-"
      EXISTS(SELECT 1 FROM accounts sub WHERE sub.number LIKE (a.number || '-%') AND sub.is_active = true) as has_analytics
    FROM accounts a
    WHERE (p_include_inactive OR a.is_active = true)
    ORDER BY a.number;
    RETURN;
  END IF;

  -- Pobierz lokalizacje użytkownika z user_locations
  SELECT ARRAY_AGG(ul.location_id) INTO v_location_ids
  FROM user_locations ul
  WHERE ul.user_id = p_user_id;

  -- Fallback do profiles.location_id
  IF v_location_ids IS NULL OR array_length(v_location_ids, 1) IS NULL THEN
    SELECT ARRAY[p.location_id] INTO v_location_ids
    FROM profiles p
    WHERE p.id = p_user_id AND p.location_id IS NOT NULL;
  END IF;

  -- Brak lokalizacji = brak kont
  IF v_location_ids IS NULL OR array_length(v_location_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Pobierz identyfikatory lokalizacji (np. '5-3')
  SELECT ARRAY_AGG(DISTINCT l.location_identifier) INTO v_location_identifiers
  FROM locations l
  WHERE l.id = ANY(v_location_ids) AND l.location_identifier IS NOT NULL;

  IF v_location_identifiers IS NULL OR array_length(v_location_identifiers, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Pobierz kategorie lokalizacji (pierwsza cyfra location_identifier) - dla ograniczeń kont
  SELECT ARRAY_AGG(DISTINCT LEFT(li, 1)) INTO v_category_prefixes
  FROM unnest(v_location_identifiers) AS li
  WHERE LEFT(li, 1) != '';

  -- Pobierz ograniczone prefiksy kont dla kategorii użytkownika
  IF v_category_prefixes IS NOT NULL AND array_length(v_category_prefixes, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT acr.account_number_prefix) INTO v_restricted_prefixes
    FROM account_category_restrictions acr
    WHERE acr.category_prefix = ANY(v_category_prefixes)
      AND acr.is_restricted = true;
  END IF;

  IF v_restricted_prefixes IS NULL THEN
    v_restricted_prefixes := ARRAY[]::text[];
  END IF;

  -- Zwróć TYLKO konta pasujące do lokalizacji użytkownika (z uwzględnieniem ograniczeń)
  RETURN QUERY
  WITH location_matched_accounts AS (
    SELECT a.id
    FROM accounts a
    CROSS JOIN UNNEST(v_location_identifiers) AS loc_id
    WHERE (p_include_inactive OR a.is_active = true)
      AND a.number LIKE '%-%'
      AND split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) = loc_id
      -- Odfiltruj ograniczone prefiksy
      AND NOT (split_part(a.number, '-', 1) = ANY(v_restricted_prefixes))
    
    UNION
    
    SELECT la.account_id
    FROM location_accounts la
    INNER JOIN accounts acc ON acc.id = la.account_id
    WHERE la.location_id = ANY(v_location_ids)
      -- Odfiltruj ograniczone prefiksy również dla ręcznie przypisanych kont
      AND NOT (split_part(acc.number, '-', 1) = ANY(v_restricted_prefixes))
  )
  SELECT DISTINCT
    a.id,
    a.number,
    a.name,
    a.type,
    a.is_active,
    a.analytical,
    -- Sprawdź czy jakiekolwiek konto zaczyna się od tego numeru + "-"
    EXISTS(SELECT 1 FROM accounts sub WHERE sub.number LIKE (a.number || '-%') AND sub.is_active = true) as has_analytics
  FROM accounts a
  INNER JOIN location_matched_accounts lma ON a.id = lma.id
  ORDER BY a.number;
END;
$function$;