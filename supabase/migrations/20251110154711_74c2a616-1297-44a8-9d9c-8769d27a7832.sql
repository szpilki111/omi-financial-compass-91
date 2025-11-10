-- Create user_locations junction table for many-to-many relationship
CREATE TABLE public.user_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id)
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_locations
CREATE POLICY "Admins and prowincjal can manage user locations"
ON public.user_locations
FOR ALL
USING (get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]))
WITH CHECK (get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]));

CREATE POLICY "Users can view their own locations"
ON public.user_locations
FOR SELECT
USING (auth.uid() = user_id OR get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]));

-- Migrate existing data from profiles.location_id to user_locations
INSERT INTO public.user_locations (user_id, location_id)
SELECT id, location_id 
FROM public.profiles 
WHERE location_id IS NOT NULL;

-- Update get_user_location_id function to return the first location
-- (for backwards compatibility with existing code)
CREATE OR REPLACE FUNCTION public.get_user_location_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN (
    SELECT location_id 
    FROM public.user_locations 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$;

-- New function to get all user locations
CREATE OR REPLACE FUNCTION public.get_user_location_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN ARRAY(
    SELECT location_id 
    FROM public.user_locations 
    WHERE user_id = auth.uid()
  );
END;
$$;