-- Dodanie UPDATE policy dla trusted_devices
CREATE POLICY "Users can update their own trusted devices"
ON trusted_devices FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);