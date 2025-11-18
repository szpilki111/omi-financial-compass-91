-- Dodaj politykę DELETE dla raportów o statusie innym niż "submitted"
-- Ekonomowie mogą usuwać tylko swoje raporty w statusie innym niż złożony

-- Najpierw usuń starą politykę ALL dla ekonomów, która może być zbyt permisywna
DROP POLICY IF EXISTS "Ekonomowie zarządzają raportami swoich lokalizacji" ON public.reports;

-- Dodaj osobne polityki dla różnych operacji
CREATE POLICY "Ekonomowie mogą tworzyć raporty dla swojej lokalizacji"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'ekonom' 
  AND location_id = get_user_location_id()
);

CREATE POLICY "Ekonomowie mogą edytować raporty swojej lokalizacji"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'ekonom' 
  AND location_id = get_user_location_id()
)
WITH CHECK (
  get_user_role() = 'ekonom' 
  AND location_id = get_user_location_id()
);

CREATE POLICY "Ekonomowie mogą usuwać raporty niezłożone"
ON public.reports
FOR DELETE
TO authenticated
USING (
  get_user_role() = 'ekonom' 
  AND location_id = get_user_location_id()
  AND status != 'submitted'
  AND status != 'approved'
);

-- Dodaj również możliwość usuwania dla adminów i prowincjałów (wszystkie raporty)
CREATE POLICY "Admini i prowincjałowie mogą usuwać wszystkie raporty"
ON public.reports
FOR DELETE
TO authenticated
USING (
  get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])
);