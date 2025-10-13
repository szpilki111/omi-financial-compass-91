-- Drop redundant policies for locations
DROP POLICY IF EXISTS "Ekonomowie widzą lokalizacje" ON public.locations;
DROP POLICY IF EXISTS "Ekonomowie widzą tylko swoje placówki" ON public.locations;
DROP POLICY IF EXISTS "Prowincjałowie widzą wszystkie lokalizacje" ON public.locations;

-- Create simplified and comprehensive SELECT policy for locations
-- Admins and prowincjal can see all locations
-- Other users (ekonom, proboszcz, asystent_ekonoma_prowincjalnego, ekonom_prowincjalny) can see only their assigned location
CREATE POLICY "Users can view locations based on their role"
ON public.locations
FOR SELECT
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.location_id = locations.id
    )
  END
);