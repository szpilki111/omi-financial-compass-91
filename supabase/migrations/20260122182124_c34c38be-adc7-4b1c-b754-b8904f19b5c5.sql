-- Polityka UPDATE dla ekonomów i proboszczów na konta analityczne ich lokalizacji
CREATE POLICY "Ekonomowie i proboszczowie mogą edytować nazwy kont swojej lokalizacji"
  ON public.accounts
  FOR UPDATE
  USING (
    CASE
      -- Admin i prowincjał mogą wszystko
      WHEN (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])) THEN true
      -- Ekonom/proboszcz może edytować konta analityczne swojej lokalizacji
      ELSE (
        analytical = true 
        AND EXISTS (
          SELECT 1
          FROM locations l
          WHERE l.id = ANY(get_user_location_ids())
            AND l.location_identifier IS NOT NULL
            AND accounts.number LIKE '%-%'
            AND (
              split_part(accounts.number, '-', 2) || '-' || split_part(accounts.number, '-', 3) = l.location_identifier
            )
        )
      )
    END
  )
  WITH CHECK (
    CASE
      WHEN (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])) THEN true
      ELSE (
        analytical = true 
        AND EXISTS (
          SELECT 1
          FROM locations l
          WHERE l.id = ANY(get_user_location_ids())
            AND l.location_identifier IS NOT NULL
            AND accounts.number LIKE '%-%'
            AND (
              split_part(accounts.number, '-', 2) || '-' || split_part(accounts.number, '-', 3) = l.location_identifier
            )
        )
      )
    END
  );