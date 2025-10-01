-- Add RLS policy to allow service_role to insert login events
CREATE POLICY "allow_service_role_insert_login_events"
ON public.user_login_events
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Add RLS policy to allow service_role to update profiles (for blocking)
CREATE POLICY "allow_service_role_update_profiles"
ON public.profiles
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add RLS policy to allow service_role to select login events (for counting)
CREATE POLICY "allow_service_role_select_login_events"
ON public.user_login_events
FOR SELECT
USING (auth.role() = 'service_role');