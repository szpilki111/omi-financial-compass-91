
-- Dodaj kolumny debit_amount i credit_amount do tabeli transactions
ALTER TABLE public.transactions 
ADD COLUMN debit_amount numeric,
ADD COLUMN credit_amount numeric;

-- Ustaw domyślne wartości dla istniejących rekordów
UPDATE public.transactions 
SET debit_amount = amount, credit_amount = amount 
WHERE debit_amount IS NULL OR credit_amount IS NULL;
