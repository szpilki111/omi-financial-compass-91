-- Poprawka izolacji kont - ścisłe filtrowanie po segmentach 2-3 numeru konta
-- Usuwa widoczność kont syntetycznych dla zwykłych użytkowników

CREATE OR REPLACE FUNCTION public.get_user_filtered_accounts_with_analytics(
  p_user_id uuid,
  p_include_inactive boolean DEFAULT false,
  p_skip_restrictions boolean DEFAULT false
)
RETURNS TABLE (
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
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_location_ids uuid[];
  v_location_identifiers text[];
BEGIN
  -- Pobierz rolę użytkownika
  SELECT p.role INTO v_user_role
  FROM profiles p
  WHERE p.id = p_user_id;

  -- Dla adminów i prowincjałów zwróć wszystkie konta
  IF v_user_role IN ('admin', 'prowincjal') OR p_skip_restrictions THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.number,
      a.name,
      a.type,
      a.is_active,
      a.analytical,
      EXISTS(
        SELECT 1 FROM accounts sub 
        WHERE sub.number LIKE a.number || '-%' 
        AND sub.is_active = true
      ) as has_analytics
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
  -- BEZ kont syntetycznych (bez myślnika) - te nie są przypisane do żadnej placówki
  RETURN QUERY
  WITH location_matched_accounts AS (
    -- Konta z lokalizacją w segmentach 2-3 (np. 110-5-3, 110-5-3-1)
    SELECT a.id
    FROM accounts a
    CROSS JOIN UNNEST(v_location_identifiers) AS loc_id
    WHERE (p_include_inactive OR a.is_active = true)
      AND a.number LIKE '%-%'  -- Musi mieć myślnik
      AND (
        -- POPRAWIONA LOGIKA: lokalizacja musi być w segmentach 2-3 numeru
        -- Format: KONTO_GŁÓWNE-LOKALIZACJA lub KONTO_GŁÓWNE-LOKALIZACJA-ANALITYKA
        split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) = loc_id
      )
    
    UNION
    
    -- Konta przypisane ręcznie przez location_accounts
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
    EXISTS(
      SELECT 1 FROM accounts sub 
      WHERE sub.number LIKE a.number || '-%' 
      AND sub.is_active = true
    ) as has_analytics
  FROM accounts a
  INNER JOIN location_matched_accounts lma ON a.id = lma.id
  ORDER BY a.number;
END;
$$;