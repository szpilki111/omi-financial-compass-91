
-- Allow superior to view reports for their assigned locations
CREATE POLICY "Superior widzi raporty swoich lokalizacji"
ON public.reports
FOR SELECT
TO public
USING (
  get_user_role() = 'superior'
  AND (location_id = get_user_location_id() OR location_id = ANY (get_user_location_ids()))
);

-- Allow superior to view profiles of users in their assigned locations (for contacts directory)
CREATE POLICY "Superior widzi profile swojej lokalizacji"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'superior'
  AND (location_id = get_user_location_id() OR location_id = ANY (get_user_location_ids()))
);

-- Allow superior to view admin_notes targeted at their location or global notes
CREATE POLICY "Superior widzi notatki dla swojej lokalizacji"
ON public.admin_notes
FOR SELECT
TO public
USING (
  get_user_role() = 'superior'
  AND (
    location_id IS NULL
    OR location_id = get_user_location_id()
    OR location_id = ANY (get_user_location_ids())
  )
);

-- Make new admin_notes visible to superior by default
ALTER TABLE public.admin_notes
  ALTER COLUMN visible_to SET DEFAULT ARRAY['ekonom'::text, 'proboszcz'::text, 'prowincjal'::text, 'admin'::text, 'superior'::text];

-- Backfill existing notes so superior can also see them (when notes were intended for ekonom/proboszcz)
UPDATE public.admin_notes
SET visible_to = array_append(visible_to, 'superior')
WHERE NOT ('superior' = ANY(visible_to));
