-- Drop existing SELECT policy on transactions
DROP POLICY IF EXISTS "Users can view transactions from their location" ON public.transactions;
DROP POLICY IF EXISTS "Transactions viewable by location users" ON public.transactions;
DROP POLICY IF EXISTS "Users can view transactions for their location or matching accounts" ON public.transactions;

-- Create new policy that allows users to see:
-- 1. All transactions from their location (existing rule)
-- 2. Transactions from other locations where the account number matches their location identifier
-- This fixes the visibility issue where houses can't see 200-x-x transactions from ekonomat
CREATE POLICY "Users can view transactions for their location or matching accounts"
ON public.transactions FOR SELECT
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE (
      -- Original rule: transactions from user's location
      location_id = ANY(get_user_location_ids())
      OR
      -- New rule: transactions where account matches user's location identifier
      EXISTS (
        SELECT 1 FROM accounts a
        WHERE (a.id = transactions.debit_account_id OR a.id = transactions.credit_account_id)
          AND a.number LIKE '%-%-%'
          AND EXISTS (
            SELECT 1 FROM locations l
            WHERE l.id = ANY(get_user_location_ids())
              AND l.location_identifier IS NOT NULL
              AND l.location_identifier LIKE '%-%'
              AND (split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3)) = l.location_identifier
          )
      )
    )
  END
);