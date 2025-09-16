-- Add location_identifier column to locations table
ALTER TABLE public.locations 
ADD COLUMN location_identifier TEXT;

-- Add index for better performance when filtering accounts
CREATE INDEX idx_locations_identifier ON public.locations(location_identifier);

-- Add comment explaining the purpose
COMMENT ON COLUMN public.locations.location_identifier IS 'Identifier used to match accounts to locations based on account number suffix (e.g., "3-13" for account "210-3-13")';