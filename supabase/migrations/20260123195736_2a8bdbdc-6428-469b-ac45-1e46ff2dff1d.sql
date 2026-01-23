-- Add new fields to locations table for report header
ALTER TABLE locations ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN locations.postal_code IS 'Kod pocztowy placówki (np. 38-500)';
COMMENT ON COLUMN locations.city IS 'Miasto placówki (np. Sanok)';
COMMENT ON COLUMN locations.bank_account IS 'Numer konta bankowego prowincji';