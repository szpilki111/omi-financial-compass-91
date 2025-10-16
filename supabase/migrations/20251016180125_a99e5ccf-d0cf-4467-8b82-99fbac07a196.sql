-- Dodaj kolumnę do przechowywania błędów walidacji w dokumentach
ALTER TABLE documents 
ADD COLUMN validation_errors jsonb DEFAULT NULL;

-- Dodaj komentarz do kolumny
COMMENT ON COLUMN documents.validation_errors IS 'Przechowuje informacje o błędach walidacji dla niekompletnych dokumentów';