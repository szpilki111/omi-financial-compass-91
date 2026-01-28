-- Dodaj brakujące konto 416-4-2 dla Prokury Misyjnej
INSERT INTO public.accounts (number, name, type, analytical, is_active)
VALUES ('416-4-2', 'Wydawnictwo', 'Przychody', false, true)
ON CONFLICT (number) DO NOTHING;