-- Poprawka RLS na budget_items - ekonomowie mogą zarządzać items również przy składaniu budżetu

-- Usuń starą politykę
DROP POLICY IF EXISTS "Użytkownicy mogą zarządzać pozycjami swojego budżetu" ON public.budget_items;

-- Nowa polityka ALL - ekonomowie mogą zarządzać items dla draft I submitted (podczas składania)
CREATE POLICY "Ekonomowie zarządzają items swojego budżetu"
ON public.budget_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM budget_plans bp
    WHERE bp.id = budget_items.budget_plan_id
    AND (
      (
        public.get_user_role() = 'ekonom' AND 
        bp.location_id = public.get_user_location_id() AND
        bp.status IN ('draft', 'submitted')
      )
      OR public.get_user_role() IN ('admin', 'prowincjal')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM budget_plans bp
    WHERE bp.id = budget_items.budget_plan_id
    AND (
      (
        public.get_user_role() = 'ekonom' AND 
        bp.location_id = public.get_user_location_id() AND
        bp.status IN ('draft', 'submitted')
      )
      OR public.get_user_role() IN ('admin', 'prowincjal')
    )
  )
);

-- Polityka SELECT pozostaje bez zmian - ekonomowie widzą items swoich budżetów
DROP POLICY IF EXISTS "Użytkownicy widzą pozycje budżetów swojej lokalizacji" ON public.budget_items;

CREATE POLICY "Użytkownicy widzą pozycje budżetów swojej lokalizacji"
ON public.budget_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM budget_plans bp
    WHERE bp.id = budget_items.budget_plan_id
    AND (
      CASE
        WHEN public.get_user_role() IN ('admin', 'prowincjal') THEN true
        ELSE bp.location_id = public.get_user_location_id()
      END
    )
  )
);