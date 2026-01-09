-- Fix: Allow users to see ALL transactions from their location, not just their own
-- This restores visibility of old transactions created by other users

-- Drop overly restrictive policy
DROP POLICY IF EXISTS "Allow economists to view their own transactions" ON public.transactions;

-- Create new policy that allows viewing transactions from user's locations
CREATE POLICY "Users can view transactions from their locations" 
ON public.transactions 
FOR SELECT 
USING (
  get_user_role() IN ('admin', 'prowincjal')
  OR location_id = ANY(get_user_location_ids())
);