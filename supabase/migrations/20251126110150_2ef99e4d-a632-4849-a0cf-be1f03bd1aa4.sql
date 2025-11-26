-- Usuwamy WSZYSTKIE istniejące polityki na budget_plans
DROP POLICY IF EXISTS "Ekonomowie mogą tworzyć budżety dla swojej lokalizacji" ON public.budget_plans;
DROP POLICY IF EXISTS "Ekonomowie mogą edytować swoje budżety draft" ON public.budget_plans;
DROP POLICY IF EXISTS "Ekonomowie mogą składać budżety do zatwierdzenia" ON public.budget_plans;
DROP POLICY IF EXISTS "Ekonomowie mogą przeglądać budżety swojej lokalizacji" ON public.budget_plans;
DROP POLICY IF EXISTS "Admin i prowincjał mogą usuwać budżety" ON public.budget_plans;
DROP POLICY IF EXISTS "Ekonomowie mogą edytować i składać swoje budżety" ON public.budget_plans;
DROP POLICY IF EXISTS "Admin może wszystko" ON public.budget_plans;
DROP POLICY IF EXISTS "Prowincjal może wszystko" ON public.budget_plans;

-- Funkcje pomocnicze (CREATE OR REPLACE więc bezpieczne)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_location_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Polityka SELECT: Ekonomowie widzą budżety swojej lokalizacji, admin/prowincjal wszystkie
CREATE POLICY "Budżety - SELECT dla wszystkich ról"
ON public.budget_plans
FOR SELECT
TO authenticated
USING (
  CASE 
    WHEN public.get_user_role() = 'ekonom' THEN 
      location_id = public.get_user_location_id()
    WHEN public.get_user_role() IN ('admin', 'prowincjal') THEN 
      true
    ELSE false
  END
);

-- Polityka INSERT: Ekonomowie mogą tworzyć budżety draft dla swojej lokalizacji
CREATE POLICY "Budżety - INSERT dla ekonomów i administratorów"
ON public.budget_plans
FOR INSERT
TO authenticated
WITH CHECK (
  CASE 
    WHEN public.get_user_role() = 'ekonom' THEN 
      location_id = public.get_user_location_id() AND
      status = 'draft' AND
      created_by = auth.uid()
    WHEN public.get_user_role() IN ('admin', 'prowincjal') THEN 
      true
    ELSE false
  END
);

-- Polityka UPDATE: Ekonomowie mogą edytować draft i złożyć (submitted)
CREATE POLICY "Budżety - UPDATE dla wszystkich ról"
ON public.budget_plans
FOR UPDATE
TO authenticated
USING (
  CASE 
    WHEN public.get_user_role() = 'ekonom' THEN 
      location_id = public.get_user_location_id() AND
      status = 'draft'
    WHEN public.get_user_role() IN ('admin', 'prowincjal') THEN 
      true
    ELSE false
  END
)
WITH CHECK (
  CASE 
    WHEN public.get_user_role() = 'ekonom' THEN 
      location_id = public.get_user_location_id() AND
      status IN ('draft', 'submitted')
    WHEN public.get_user_role() IN ('admin', 'prowincjal') THEN 
      true
    ELSE false
  END
);

-- Polityka DELETE: Tylko admin i prowincjał
CREATE POLICY "Budżety - DELETE dla administratorów"
ON public.budget_plans
FOR DELETE
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'prowincjal')
);