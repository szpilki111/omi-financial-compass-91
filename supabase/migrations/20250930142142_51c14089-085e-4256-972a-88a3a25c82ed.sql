-- Tworzenie tabeli dla śledzenia błędnych logowań
CREATE TABLE IF NOT EXISTS public.failed_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Włączenie RLS
ALTER TABLE public.failed_logins ENABLE ROW LEVEL SECURITY;

-- Policy pozwalająca wszystkim na INSERT (aby można było logować nieudane próby)
CREATE POLICY "Anyone can insert failed login attempts"
ON public.failed_logins
FOR INSERT
WITH CHECK (true);

-- Policy pozwalająca wszystkim na SELECT (aby móc sprawdzić liczbę prób)
CREATE POLICY "Anyone can view failed login attempts"
ON public.failed_logins
FOR SELECT
USING (true);

-- Policy pozwalająca wszystkim na UPDATE (aby móc zwiększyć licznik)
CREATE POLICY "Anyone can update failed login attempts"
ON public.failed_logins
FOR UPDATE
USING (true);

-- Policy pozwalająca wszystkim na DELETE (aby móc usunąć po udanym logowaniu)
CREATE POLICY "Anyone can delete failed login attempts"
ON public.failed_logins
FOR DELETE
USING (true);

-- Index dla szybszego wyszukiwania po email
CREATE INDEX idx_failed_logins_email ON public.failed_logins(email);