-- Napraw RLS na tabeli locations żeby użytkownicy z wieloma lokalizacjami widzieli wszystkie swoje lokalizacje

-- Usuń stare RLS policy
DROP POLICY IF EXISTS "Users can view locations based on their role" ON public.locations;

-- Stwórz nową policy sprawdzającą user_locations
CREATE POLICY "Users can view locations based on their role" 
ON public.locations 
FOR SELECT 
USING (
  CASE
    WHEN (get_user_role() = ANY (ARRAY['admin'::text, 'prowincjal'::text])) THEN true
    ELSE (
      -- Sprawdź user_locations (dla użytkowników z wieloma lokalizacjami)
      EXISTS ( 
        SELECT 1 
        FROM public.user_locations 
        WHERE user_locations.user_id = auth.uid() 
          AND user_locations.location_id = locations.id
      ) 
      OR 
      -- Lub sprawdź profiles.location_id (dla kompatybilności wstecznej)
      EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE profiles.id = auth.uid() 
          AND profiles.location_id = locations.id
      )
    )
  END
);