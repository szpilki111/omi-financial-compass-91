-- Allow economists to insert accounts for their location
CREATE POLICY "Ekonomowie mogą dodawać konta dla swojej placówki" 
ON accounts 
FOR INSERT 
WITH CHECK (
  CASE 
    WHEN get_user_role() = 'ekonom' THEN (
      -- Allow economists to create accounts if the account number follows the pattern
      -- that matches their location identifier
      EXISTS (
        SELECT 1 
        FROM locations l, profiles p
        WHERE p.id = auth.uid() 
        AND p.location_id = l.id 
        AND l.location_identifier IS NOT NULL
        -- Extract suffix from account number (everything after first hyphen)
        AND CASE 
          WHEN position('-' in accounts.number) > 0 THEN
            substring(accounts.number from position('-' in accounts.number) + 1)
          ELSE ''
        END LIKE l.location_identifier || '%'
      )
    )
    ELSE get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])
  END
);