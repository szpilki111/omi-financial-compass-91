-- Add analytical_required column to account_category_restrictions table
ALTER TABLE account_category_restrictions 
ADD COLUMN analytical_required boolean NOT NULL DEFAULT false;