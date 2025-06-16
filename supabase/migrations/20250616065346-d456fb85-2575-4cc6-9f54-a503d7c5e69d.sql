
-- Create a function to delete a document and all its related transactions
CREATE OR REPLACE FUNCTION delete_document_with_transactions(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First delete all transactions related to this document
  DELETE FROM transactions WHERE document_id = p_document_id;
  
  -- Then delete the document itself
  DELETE FROM documents WHERE id = p_document_id;
END;
$$;
