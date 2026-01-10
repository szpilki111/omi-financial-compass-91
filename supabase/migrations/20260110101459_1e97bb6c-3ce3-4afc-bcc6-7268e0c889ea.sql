-- Aktualizacja funkcji get_user_filtered_accounts
-- 1. Admin ZAWSZE widzi wszystkie konta (bez filtrów lokalizacyjnych i bez restrykcji)
-- 2. Obsługa jednoczęściowych identyfikatorów lokalizacji (np. "1" dla Prowincji)

CREATE OR REPLACE FUNCTION public.get_user_filtered_accounts(p_user_id uuid, p_include_inactive boolean DEFAULT false, p_skip_restrictions boolean DEFAULT false)
 RETURNS TABLE(id uuid, number text, name text, type text, analytical boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  location_ids uuid[];
  location_identifiers text[];
  location_categories text[];
  restricted_prefixes text[];
BEGIN
  -- Pobierz rolę użytkownika
  SELECT role INTO user_role FROM profiles WHERE profiles.id = p_user_id;
  
  -- Admin ZAWSZE widzi wszystkie konta bez żadnych filtrów i ograniczeń
  IF user_role = 'admin' THEN
    RETURN QUERY
    SELECT a.id, a.number, a.name, a.type, a.analytical
    FROM accounts a
    WHERE (p_include_inactive OR a.is_active = true)
    ORDER BY a.number;
    RETURN;
  END IF;
  
  -- Prowincjał z skip_restrictions widzi wszystkie konta
  IF user_role = 'prowincjal' AND p_skip_restrictions THEN
    RETURN QUERY
    SELECT a.id, a.number, a.name, a.type, a.analytical
    FROM accounts a
    WHERE (p_include_inactive OR a.is_active = true)
    ORDER BY a.number;
    RETURN;
  END IF;
  
  -- Pobierz lokalizacje użytkownika
  SELECT ARRAY_AGG(ul.location_id) INTO location_ids
  FROM user_locations ul
  WHERE ul.user_id = p_user_id;
  
  IF location_ids IS NULL OR array_length(location_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- Pobierz identyfikatory lokalizacji
  SELECT ARRAY_AGG(DISTINCT l.location_identifier) INTO location_identifiers
  FROM locations l
  WHERE l.id = ANY(location_ids)
    AND l.location_identifier IS NOT NULL;
  
  IF location_identifiers IS NULL THEN
    location_identifiers := ARRAY[]::text[];
  END IF;
  
  -- Pobierz kategorie (pierwsza część identyfikatora)
  SELECT ARRAY_AGG(DISTINCT split_part(li, '-', 1))
  INTO location_categories
  FROM unnest(location_identifiers) AS li
  WHERE split_part(li, '-', 1) != '';
  
  IF location_categories IS NULL THEN
    location_categories := ARRAY[]::text[];
  END IF;
  
  -- Pobierz ograniczone prefiksy (jeśli nie skip_restrictions)
  IF NOT p_skip_restrictions AND array_length(location_categories, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT acr.account_number_prefix)
    INTO restricted_prefixes
    FROM account_category_restrictions acr
    WHERE acr.category_prefix = ANY(location_categories)
      AND acr.is_restricted = true;
  END IF;
  
  IF restricted_prefixes IS NULL THEN
    restricted_prefixes := ARRAY[]::text[];
  END IF;
  
  -- Zwróć konta pasujące do identyfikatorów lokalizacji lub ręcznie przypisane
  RETURN QUERY
  SELECT DISTINCT a.id, a.number, a.name, a.type, a.analytical
  FROM accounts a
  WHERE (p_include_inactive OR a.is_active = true)
    AND (
      -- Ręcznie przypisane do lokalizacji użytkownika
      EXISTS (
        SELECT 1 FROM location_accounts la
        WHERE la.account_id = a.id
          AND la.location_id = ANY(location_ids)
      )
      OR
      -- Pasuje do identyfikatora lokalizacji
      EXISTS (
        SELECT 1 FROM unnest(location_identifiers) AS loc_id
        WHERE 
          -- Dwuczęściowy identyfikator (np. "2-1")
          (
            position('-' in loc_id) > 0
            AND split_part(a.number, '-', 2) = split_part(loc_id, '-', 1)
            AND split_part(a.number, '-', 3) = split_part(loc_id, '-', 2)
            AND split_part(a.number, '-', 2) != ''
            AND split_part(a.number, '-', 3) != ''
          )
          OR
          -- Jednoczęściowy identyfikator (np. "1" dla Prowincji)
          (
            position('-' in loc_id) = 0
            AND loc_id != ''
            AND split_part(a.number, '-', 2) = loc_id
            AND split_part(a.number, '-', 2) != ''
          )
      )
    )
    -- Odfiltruj ograniczone prefiksy
    AND NOT (split_part(a.number, '-', 1) = ANY(restricted_prefixes))
  ORDER BY a.number;
END;
$function$;