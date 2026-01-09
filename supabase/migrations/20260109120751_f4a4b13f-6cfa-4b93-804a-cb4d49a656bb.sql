-- Drop old INSERT policy for economists
DROP POLICY IF EXISTS "Ekonomowie mogą tworzyć raporty dla swojej lokalizacji" ON public.reports;

-- Create new INSERT policy that checks user_locations table
CREATE POLICY "Ekonomowie mogą tworzyć raporty dla swoich lokalizacji" 
ON public.reports 
FOR INSERT 
TO authenticated
WITH CHECK (
  get_user_role() = 'ekonom' 
  AND location_id = ANY(get_user_location_ids())
);

-- Also fix SELECT policy for economists
DROP POLICY IF EXISTS "Ekonomowie widzą raporty swojej placówki" ON public.reports;

CREATE POLICY "Ekonomowie widzą raporty swoich placówek" 
ON public.reports 
FOR SELECT 
TO authenticated
USING (
  get_user_role() = 'ekonom' 
  AND location_id = ANY(get_user_location_ids())
);

-- Also fix UPDATE policy for economists
DROP POLICY IF EXISTS "Ekonomowie mogą edytować raporty swojej lokalizacji" ON public.reports;

CREATE POLICY "Ekonomowie mogą edytować raporty swoich lokalizacji" 
ON public.reports 
FOR UPDATE 
TO authenticated
USING (
  get_user_role() = 'ekonom' 
  AND location_id = ANY(get_user_location_ids())
)
WITH CHECK (
  get_user_role() = 'ekonom' 
  AND location_id = ANY(get_user_location_ids())
);

-- Also fix DELETE policy for economists
DROP POLICY IF EXISTS "Ekonomowie mogą usuwać raporty niezłożone" ON public.reports;

CREATE POLICY "Ekonomowie mogą usuwać raporty niezłożone" 
ON public.reports 
FOR DELETE 
TO authenticated
USING (
  get_user_role() = 'ekonom' 
  AND location_id = ANY(get_user_location_ids())
  AND status NOT IN ('submitted', 'approved')
);