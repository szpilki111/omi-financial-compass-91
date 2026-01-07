
-- Usuń stare polityki dla analytical_accounts
DROP POLICY IF EXISTS "Admini i prowincjałowie zarządzają wszystkimi podkontami" ON public.analytical_accounts;
DROP POLICY IF EXISTS "Ekonomowie tworzą podkonta dla swojej placówki" ON public.analytical_accounts;
DROP POLICY IF EXISTS "Ekonomowie widzą podkonta swojej placówki" ON public.analytical_accounts;
DROP POLICY IF EXISTS "Ekonomowie edytują podkonta swojej placówki" ON public.analytical_accounts;
DROP POLICY IF EXISTS "Ekonomowie usuwają podkonta swojej placówki" ON public.analytical_accounts;

-- SELECT: Użytkownicy widzą podkonta swojej lokalizacji (lub admin/prowincjal wszystkie)
CREATE POLICY "Użytkownicy widzą podkonta swojej lokalizacji"
ON public.analytical_accounts
FOR SELECT
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE location_id = ANY(get_user_location_ids())
  END
);

-- INSERT: Użytkownicy z lokalizacją mogą tworzyć podkonta dla swojej lokalizacji
CREATE POLICY "Użytkownicy tworzą podkonta dla swojej lokalizacji"
ON public.analytical_accounts
FOR INSERT
WITH CHECK (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE location_id = ANY(get_user_location_ids()) AND created_by = auth.uid()
  END
);

-- UPDATE: Użytkownicy z lokalizacją mogą edytować podkonta swojej lokalizacji
CREATE POLICY "Użytkownicy edytują podkonta swojej lokalizacji"
ON public.analytical_accounts
FOR UPDATE
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE location_id = ANY(get_user_location_ids())
  END
);

-- DELETE: Użytkownicy z lokalizacją mogą usuwać podkonta swojej lokalizacji
CREATE POLICY "Użytkownicy usuwają podkonta swojej lokalizacji"
ON public.analytical_accounts
FOR DELETE
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE location_id = ANY(get_user_location_ids())
  END
);
