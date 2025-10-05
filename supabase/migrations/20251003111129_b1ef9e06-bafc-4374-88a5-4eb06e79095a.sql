-- Usuń istniejące nieprawidłowe polityki dla dokumentów
DROP POLICY IF EXISTS "Users can view documents from their location" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create documents for their location" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update documents from their location" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete documents from their location" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- Polityki SELECT - użytkownicy widzą tylko dokumenty ze swojej lokalizacji
CREATE POLICY "Users can view documents from their location"
ON documents
FOR SELECT
USING (
  CASE
    WHEN get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]) THEN true
    ELSE location_id = get_user_location_id()
  END
);

-- Polityki INSERT - użytkownicy mogą tworzyć dokumenty tylko dla swojej lokalizacji
CREATE POLICY "Users can create documents for their location"
ON documents
FOR INSERT
WITH CHECK (
  CASE
    WHEN get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]) THEN true
    ELSE location_id = get_user_location_id() AND user_id = auth.uid()
  END
);

-- Polityki UPDATE - użytkownicy mogą aktualizować dokumenty tylko ze swojej lokalizacji
CREATE POLICY "Users can update documents from their location"
ON documents
FOR UPDATE
USING (
  CASE
    WHEN get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]) THEN true
    ELSE location_id = get_user_location_id()
  END
);

-- Polityki DELETE - użytkownicy mogą usuwać dokumenty tylko ze swojej lokalizacji
CREATE POLICY "Users can delete documents from their location"
ON documents
FOR DELETE
USING (
  CASE
    WHEN get_user_role() = ANY(ARRAY['admin'::text, 'prowincjal'::text]) THEN true
    ELSE location_id = get_user_location_id()
  END
);