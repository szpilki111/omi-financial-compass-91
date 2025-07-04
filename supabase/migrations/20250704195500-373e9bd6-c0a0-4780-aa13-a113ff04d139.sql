
-- Dodaj kolumnę do location_settings określającą czy dom może operować walutami obcymi
ALTER TABLE public.location_settings 
ADD COLUMN allow_foreign_currencies boolean NOT NULL DEFAULT false;

-- Dodaj komentarz dla lepszego zrozumienia
COMMENT ON COLUMN public.location_settings.allow_foreign_currencies IS 'Określa czy dana lokalizacja może operować walutami obcymi';
