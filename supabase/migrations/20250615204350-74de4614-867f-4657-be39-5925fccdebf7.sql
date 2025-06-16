
-- Usuń wszystkie transakcje, które nie mają przypisanego dokumentu
DELETE FROM public.transactions 
WHERE document_id IS NULL;
