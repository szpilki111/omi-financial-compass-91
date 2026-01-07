-- Etap A: Naprawa RLS dla tabeli accounts - dodanie uprawnień dla użytkowników z lokalizacjami

-- Usuń starą politykę INSERT dla accounts
DROP POLICY IF EXISTS "Ekonomowie tworzą konta dla swojej placówki" ON public.accounts;
DROP POLICY IF EXISTS "Użytkownicy z lokalizacją mogą tworzyć konta" ON public.accounts;

-- Nowa polityka INSERT: admin/prowincjal mogą wszystko, użytkownicy z lokalizacją mogą tworzyć konta analityczne
CREATE POLICY "Użytkownicy z lokalizacją mogą tworzyć konta"
ON public.accounts
FOR INSERT
WITH CHECK (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE (
      -- Użytkownik musi mieć przypisaną lokalizację
      array_length(get_user_location_ids(), 1) > 0
      -- I konto musi być oznaczone jako analityczne (podkonto)
      AND analytical = true
    )
  END
);

-- Etap C: Sprzątanie osieroconych rekordów w analytical_accounts
-- Usuń rekordy z analytical_accounts, które nie mają odpowiadającego konta w accounts
DELETE FROM public.analytical_accounts aa
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts a 
  WHERE a.id = aa.parent_account_id
    -- Sprawdź też czy istnieje konto analityczne o odpowiednim numerze
    OR a.number = (
      SELECT acc.number || '-' || aa.number_suffix 
      FROM accounts acc 
      WHERE acc.id = aa.parent_account_id
    )
);