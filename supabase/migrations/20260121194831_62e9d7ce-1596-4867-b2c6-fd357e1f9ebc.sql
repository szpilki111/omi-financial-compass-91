-- Dodaj kolumnę exchange_rate do tabeli documents (domyślnie 1 dla PLN)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;

-- Dodaj indeks na exchange_rate_history dla szybkiego wyszukiwania kursów
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_currency_date 
ON public.exchange_rate_history(currency_code, effective_date DESC);

-- Funkcja SQL do sprawdzania czy konto główne ma konta analityczne
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
  analytical boolean,
  has_analytics boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_location_id uuid;
  v_location_identifier text;
  v_location_category text;
BEGIN
  -- Pobierz rolę i lokalizację użytkownika
  SELECT p.role, p.location_id INTO v_user_role, v_location_id
  FROM profiles p
  WHERE p.id = p_user_id;

  -- Admin i prowincjał zawsze widzą wszystko
  IF v_user_role IN ('admin', 'prowincjal') OR p_skip_restrictions THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.number,
      a.name,
      a.type,
      a.analytical,
      EXISTS (
        SELECT 1 FROM analytical_accounts aa 
        WHERE aa.parent_account_id = a.id
      ) as has_analytics
    FROM accounts a
    WHERE (p_include_inactive OR a.is_active = true)
    ORDER BY a.number;
    RETURN;
  END IF;

  -- Pobierz location_identifier
  SELECT l.location_identifier INTO v_location_identifier
  FROM locations l
  WHERE l.id = v_location_id;

  -- Wyodrębnij kategorię (pierwszy segment przed myślnikiem)
  IF v_location_identifier IS NOT NULL THEN
    v_location_category := split_part(v_location_identifier, '-', 1);
  END IF;

  -- Zwróć konta z filtrowaniem i flagą has_analytics
  RETURN QUERY
  SELECT 
    a.id,
    a.number,
    a.name,
    a.type,
    a.analytical,
    EXISTS (
      SELECT 1 FROM analytical_accounts aa 
      WHERE aa.parent_account_id = a.id
    ) as has_analytics
  FROM accounts a
  WHERE (p_include_inactive OR a.is_active = true)
    AND NOT EXISTS (
      SELECT 1 FROM account_category_restrictions acr
      WHERE acr.category_prefix = v_location_category
        AND acr.is_restricted = true
        AND a.number LIKE acr.account_number_prefix || '%'
    )
  ORDER BY a.number;
END;
$$;

-- Nadaj uprawnienia
GRANT EXECUTE ON FUNCTION public.get_user_filtered_accounts_with_analytics TO authenticated;