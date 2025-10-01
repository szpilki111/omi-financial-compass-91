-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own login events" ON public.user_login_events;
DROP POLICY IF EXISTS "Admins and prowincjal can insert login events" ON public.user_login_events;

-- Allow authenticated users to insert ANY login event
-- This is needed because during failed login, user is not authenticated as that user_id yet
CREATE POLICY "Authenticated users can insert login events"
ON public.user_login_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Keep the select policies
-- Already exists: "Admins and prowincjal can select all login events"
-- Already exists: "Users can view their own login events"