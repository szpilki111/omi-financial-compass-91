
-- Add parent_transaction_id column to track split transactions
ALTER TABLE transactions 
ADD COLUMN parent_transaction_id UUID REFERENCES transactions(id);

-- Add is_split_transaction column to identify transactions that have been split
ALTER TABLE transactions 
ADD COLUMN is_split_transaction BOOLEAN DEFAULT FALSE;

-- Create index for better performance when querying split transactions
CREATE INDEX idx_transactions_parent_id ON transactions(parent_transaction_id);

-- Add comment to document the relationship
COMMENT ON COLUMN transactions.parent_transaction_id IS 'References the original transaction when this is a sub-transaction from splitting';
COMMENT ON COLUMN transactions.is_split_transaction IS 'TRUE when this transaction has been split into sub-transactions';
