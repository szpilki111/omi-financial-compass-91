-- Add RLS policy to allow ekonom and proboszcz to delete analytical accounts they created
CREATE POLICY "Ekonomowie i proboszczowie mogą usuwać konta analityczne swojej placówki"
ON public.accounts
FOR DELETE
USING (
  CASE
    WHEN get_user_role() IN ('ekonom', 'proboszcz') THEN 
      -- Allow deletion if the account is an analytical account (contains hyphen after base number)
      -- and matches the user's location identifier
      EXISTS (
        SELECT 1
        FROM locations l, profiles p
        WHERE p.id = auth.uid()
        AND p.location_id = l.id
        AND l.location_identifier IS NOT NULL
        AND accounts.number LIKE '%-%-%'  -- Must be analytical (has at least 2 hyphens)
        AND SUBSTRING(accounts.number FROM POSITION('-' IN accounts.number) + 1) LIKE l.location_identifier || '%'
      )
    ELSE get_user_role() IN ('admin', 'prowincjal')
  END
);