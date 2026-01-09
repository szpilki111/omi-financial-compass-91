-- Helper function to check report access based on location
CREATE OR REPLACE FUNCTION public.can_access_report(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM reports r
    WHERE r.id = p_report_id
      AND (
        r.location_id = ANY(get_user_location_ids())
        OR get_user_role() IN ('admin', 'prowincjal')
      )
  )
$$;

-- =====================================================
-- RLS Policies for reports table - add proboszcz role
-- =====================================================

-- INSERT for proboszcz
DROP POLICY IF EXISTS "Proboszczowie mogą tworzyć raporty dla swoich lokalizacji" ON public.reports;
CREATE POLICY "Proboszczowie mogą tworzyć raporty dla swoich lokalizacji"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'proboszcz'
  AND location_id = ANY(get_user_location_ids())
);

-- SELECT for proboszcz
DROP POLICY IF EXISTS "Proboszczowie widzą raporty swoich placówek" ON public.reports;
CREATE POLICY "Proboszczowie widzą raporty swoich placówek"
ON public.reports
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'proboszcz'
  AND location_id = ANY(get_user_location_ids())
);

-- UPDATE for proboszcz
DROP POLICY IF EXISTS "Proboszczowie mogą edytować raporty swoich lokalizacji" ON public.reports;
CREATE POLICY "Proboszczowie mogą edytować raporty swoich lokalizacji"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'proboszcz'
  AND location_id = ANY(get_user_location_ids())
  AND status NOT IN ('submitted', 'approved')
)
WITH CHECK (
  get_user_role() = 'proboszcz'
  AND location_id = ANY(get_user_location_ids())
);

-- DELETE for proboszcz
DROP POLICY IF EXISTS "Proboszczowie mogą usuwać raporty niezłożone" ON public.reports;
CREATE POLICY "Proboszczowie mogą usuwać raporty niezłożone"
ON public.reports
FOR DELETE
TO authenticated
USING (
  get_user_role() = 'proboszcz'
  AND location_id = ANY(get_user_location_ids())
  AND status NOT IN ('submitted', 'approved')
);

-- =====================================================
-- RLS Policies for report_details table
-- =====================================================

-- SELECT
DROP POLICY IF EXISTS "Użytkownicy mogą widzieć szczegóły raportów swoich lokalizacji" ON public.report_details;
CREATE POLICY "Użytkownicy mogą widzieć szczegóły raportów swoich lokalizacji"
ON public.report_details
FOR SELECT
TO authenticated
USING (can_access_report(report_id));

-- INSERT
DROP POLICY IF EXISTS "Użytkownicy mogą tworzyć szczegóły raportów swoich lokalizacji" ON public.report_details;
CREATE POLICY "Użytkownicy mogą tworzyć szczegóły raportów swoich lokalizacji"
ON public.report_details
FOR INSERT
TO authenticated
WITH CHECK (can_access_report(report_id));

-- UPDATE
DROP POLICY IF EXISTS "Użytkownicy mogą edytować szczegóły raportów swoich lokalizacji" ON public.report_details;
CREATE POLICY "Użytkownicy mogą edytować szczegóły raportów swoich lokalizacji"
ON public.report_details
FOR UPDATE
TO authenticated
USING (can_access_report(report_id))
WITH CHECK (can_access_report(report_id));

-- DELETE
DROP POLICY IF EXISTS "Użytkownicy mogą usuwać szczegóły raportów swoich lokalizacji" ON public.report_details;
CREATE POLICY "Użytkownicy mogą usuwać szczegóły raportów swoich lokalizacji"
ON public.report_details
FOR DELETE
TO authenticated
USING (can_access_report(report_id));

-- =====================================================
-- RLS Policies for report_account_details table
-- =====================================================

-- SELECT
DROP POLICY IF EXISTS "Użytkownicy mogą widzieć rozpiskę kont raportów swoich lokalizacji" ON public.report_account_details;
CREATE POLICY "Użytkownicy mogą widzieć rozpiskę kont raportów swoich lokalizacji"
ON public.report_account_details
FOR SELECT
TO authenticated
USING (can_access_report(report_id));

-- INSERT
DROP POLICY IF EXISTS "Użytkownicy mogą tworzyć rozpiskę kont raportów swoich lokalizacji" ON public.report_account_details;
CREATE POLICY "Użytkownicy mogą tworzyć rozpiskę kont raportów swoich lokalizacji"
ON public.report_account_details
FOR INSERT
TO authenticated
WITH CHECK (can_access_report(report_id));

-- UPDATE
DROP POLICY IF EXISTS "Użytkownicy mogą edytować rozpiskę kont raportów swoich lokalizacji" ON public.report_account_details;
CREATE POLICY "Użytkownicy mogą edytować rozpiskę kont raportów swoich lokalizacji"
ON public.report_account_details
FOR UPDATE
TO authenticated
USING (can_access_report(report_id))
WITH CHECK (can_access_report(report_id));

-- DELETE
DROP POLICY IF EXISTS "Użytkownicy mogą usuwać rozpiskę kont raportów swoich lokalizacji" ON public.report_account_details;
CREATE POLICY "Użytkownicy mogą usuwać rozpiskę kont raportów swoich lokalizacji"
ON public.report_account_details
FOR DELETE
TO authenticated
USING (can_access_report(report_id));

-- =====================================================
-- RLS Policies for report_entries table
-- =====================================================

-- SELECT
DROP POLICY IF EXISTS "Użytkownicy mogą widzieć wpisy raportów swoich lokalizacji" ON public.report_entries;
CREATE POLICY "Użytkownicy mogą widzieć wpisy raportów swoich lokalizacji"
ON public.report_entries
FOR SELECT
TO authenticated
USING (can_access_report(report_id));

-- INSERT
DROP POLICY IF EXISTS "Użytkownicy mogą tworzyć wpisy raportów swoich lokalizacji" ON public.report_entries;
CREATE POLICY "Użytkownicy mogą tworzyć wpisy raportów swoich lokalizacji"
ON public.report_entries
FOR INSERT
TO authenticated
WITH CHECK (can_access_report(report_id));

-- UPDATE
DROP POLICY IF EXISTS "Użytkownicy mogą edytować wpisy raportów swoich lokalizacji" ON public.report_entries;
CREATE POLICY "Użytkownicy mogą edytować wpisy raportów swoich lokalizacji"
ON public.report_entries
FOR UPDATE
TO authenticated
USING (can_access_report(report_id))
WITH CHECK (can_access_report(report_id));

-- DELETE
DROP POLICY IF EXISTS "Użytkownicy mogą usuwać wpisy raportów swoich lokalizacji" ON public.report_entries;
CREATE POLICY "Użytkownicy mogą usuwać wpisy raportów swoich lokalizacji"
ON public.report_entries
FOR DELETE
TO authenticated
USING (can_access_report(report_id));