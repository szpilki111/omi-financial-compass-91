-- Allow users to delete transactions from their location
-- This is needed so users can delete documents (which cascades to transactions)
CREATE POLICY "Users can delete transactions from their location"
ON transactions
FOR DELETE
USING (
  CASE
    WHEN get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text]) THEN true
    ELSE location_id = get_user_location_id()
  END
);