
-- Pozwól prowincjałom zarządzać (INSERT/UPDATE/DELETE/SELECT) tabelą locations
CREATE POLICY "Prowincjałowie zarządzają placówkami"
ON public.locations
FOR ALL
USING (get_user_role() = 'prowincjal')
WITH CHECK (get_user_role() = 'prowincjal');
