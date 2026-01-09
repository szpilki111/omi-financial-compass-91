-- Fix economist report access: support both profiles.location_id (legacy) and user_locations (multi-location)

-- INSERT
DROP POLICY IF EXISTS "Ekonomowie mogą tworzyć raporty dla swoich lokalizacji" ON public.reports;
CREATE POLICY "Ekonomowie mogą tworzyć raporty dla swoich lokalizacji"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'ekonom'
  AND (
    location_id = get_user_location_id()
    OR location_id = ANY(get_user_location_ids())
  )
);

-- SELECT
DROP POLICY IF EXISTS "Ekonomowie widzą raporty swoich placówek" ON public.reports;
CREATE POLICY "Ekonomowie widzą raporty swoich placówek"
ON public.reports
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'ekonom'
  AND (
    location_id = get_user_location_id()
    OR location_id = ANY(get_user_location_ids())
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Ekonomowie mogą edytować raporty swoich lokalizacji" ON public.reports;
CREATE POLICY "Ekonomowie mogą edytować raporty swoich lokalizacji"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'ekonom'
  AND (
    location_id = get_user_location_id()
    OR location_id = ANY(get_user_location_ids())
  )
)
WITH CHECK (
  get_user_role() = 'ekonom'
  AND (
    location_id = get_user_location_id()
    OR location_id = ANY(get_user_location_ids())
  )
);

-- DELETE
DROP POLICY IF EXISTS "Ekonomowie mogą usuwać raporty niezłożone" ON public.reports;
CREATE POLICY "Ekonomowie mogą usuwać raporty niezłożone"
ON public.reports
FOR DELETE
TO authenticated
USING (
  get_user_role() = 'ekonom'
  AND (
    location_id = get_user_location_id()
    OR location_id = ANY(get_user_location_ids())
  )
  AND status NOT IN ('submitted', 'approved')
);
