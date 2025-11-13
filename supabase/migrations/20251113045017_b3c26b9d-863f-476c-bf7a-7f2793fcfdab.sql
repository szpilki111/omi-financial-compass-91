-- Add is_parallel field to transactions table to distinguish parallel transactions
ALTER TABLE transactions 
ADD COLUMN is_parallel boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX idx_transactions_is_parallel ON transactions(document_id, is_parallel, display_order);