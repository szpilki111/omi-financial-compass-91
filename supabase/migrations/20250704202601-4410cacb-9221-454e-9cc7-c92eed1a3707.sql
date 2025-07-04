
-- Add currency field to documents table
ALTER TABLE public.documents 
ADD COLUMN currency text NOT NULL DEFAULT 'PLN';
