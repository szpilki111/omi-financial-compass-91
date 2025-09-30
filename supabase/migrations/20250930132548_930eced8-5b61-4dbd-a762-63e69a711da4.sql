-- Allow all authenticated users to insert their own login events
DROP POLICY IF EXISTS "Users can insert their own login events" ON public.user_login_events;

CREATE POLICY "Users can insert their own login events"
ON public.user_login_events
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'prowincjal')
  )
);