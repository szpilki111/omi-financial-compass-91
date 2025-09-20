-- Update RLS policies for accounts table to ensure prowincjal can update analytical field
DROP POLICY IF EXISTS "Admini zarządzają kontami" ON accounts;

CREATE POLICY "Admini i prowincjałowie zarządzają kontami" 
ON accounts 
FOR ALL 
USING (get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]))
WITH CHECK (get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]));