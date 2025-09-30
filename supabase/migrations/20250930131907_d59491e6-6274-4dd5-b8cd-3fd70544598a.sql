-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins and prowincjal can insert login events" ON public.user_login_events;
DROP POLICY IF EXISTS "Admins and prowincjal can select all login events" ON public.user_login_events;

-- Ensure admin and prowincjal can insert login events from client side if needed
CREATE POLICY "Admins and prowincjal can insert login events"
ON public.user_login_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'prowincjal')
  )
);

-- Allow admin and prowincjal to select all login events
CREATE POLICY "Admins and prowincjal can select all login events"
ON public.user_login_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'prowincjal')
  )
);