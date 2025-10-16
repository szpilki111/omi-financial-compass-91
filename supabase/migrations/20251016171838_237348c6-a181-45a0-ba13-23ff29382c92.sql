-- Add display_order column to transactions table
ALTER TABLE transactions 
ADD COLUMN display_order integer;

-- Create index for better performance when sorting
CREATE INDEX idx_transactions_display_order ON transactions(document_id, display_order);

-- Update existing transactions to have sequential order based on created_at
WITH ordered_transactions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at) as row_num
  FROM transactions
)
UPDATE transactions t
SET display_order = ot.row_num
FROM ordered_transactions ot
WHERE t.id = ot.id;