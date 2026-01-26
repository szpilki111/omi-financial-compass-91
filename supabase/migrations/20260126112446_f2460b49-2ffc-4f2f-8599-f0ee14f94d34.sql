
-- Optymalizacja funkcji get_user_filtered_accounts_with_analytics
-- Problem: dla admina timeout przy 6000+ kontach z powodu wolnego has_analytics

-- 1. Dodaj indeks na accounts.number dla szybszego LIKE
CREATE INDEX IF NOT EXISTS idx_accounts_number_pattern ON accounts (number text_pattern_ops);

-- 2. Przepisz funkcję z cache'owaną tabelą has_analytics zamiast correlated subquery
CREATE OR REPLACE FUNCTION public.get_user_filtered_accounts_with_analytics(
  p_user_id uuid, 
  p_include_inactive boolean DEFAULT false, 
  p_skip_restrictions boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, 
  number text, 
  name text, 
  type text, 
  is_active boolean, 
  analytical boolean, 
  has_analytics boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role text;
  v_location_ids uuid[];
  v_location_identifiers text[];
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
      EXISTS(SELECT 1 FROM parent_accounts pa WHERE a.number = pa.parent_prefix) as has_analytics
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

  -- Zwróć TYLKO konta pasujące do lokalizacji użytkownika
  RETURN QUERY
  WITH parent_accounts AS (
    SELECT DISTINCT split_part(a.number, '-', 1) || '-' || split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) as parent_prefix
    FROM accounts a
    WHERE a.number LIKE '%-%-%-%'
      AND a.is_active = true
  ),
  location_matched_accounts AS (
    SELECT a.id
    FROM accounts a
    CROSS JOIN UNNEST(v_location_identifiers) AS loc_id
    WHERE (p_include_inactive OR a.is_active = true)
      AND a.number LIKE '%-%'
      AND split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) = loc_id
    
    UNION
    
    SELECT la.account_id
    FROM location_accounts la
    WHERE la.location_id = ANY(v_location_ids)
  )
  SELECT DISTINCT
    a.id,
    a.number,
    a.name,
    a.type,
    a.is_active,
    a.analytical,
    EXISTS(SELECT 1 FROM parent_accounts pa WHERE a.number = pa.parent_prefix) as has_analytics
  FROM accounts a
  INNER JOIN location_matched_accounts lma ON a.id = lma.id
  ORDER BY a.number;
END;
$function$;
