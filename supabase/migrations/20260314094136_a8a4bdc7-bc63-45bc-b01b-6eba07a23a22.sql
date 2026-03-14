
-- Zmiana unique constraint aby obsłużyć konto 215 po obu stronach (przychody i koszty)
ALTER TABLE budget_items DROP CONSTRAINT budget_items_budget_plan_id_account_prefix_key;
ALTER TABLE budget_items ADD CONSTRAINT budget_items_budget_plan_id_account_prefix_account_type_key 
  UNIQUE (budget_plan_id, account_prefix, account_type);

-- Dodanie konta 215 (Pożyczki Ma) jako przychód
INSERT INTO budget_items (budget_plan_id, account_type, account_prefix, account_name, planned_amount, forecasted_amount, previous_year_amount)
SELECT bp.id, 'income', '215-' || l.location_identifier, 'Pożyczki (Ma)', 0, 0, 0
FROM budget_plans bp JOIN locations l ON l.id = bp.location_id
WHERE NOT EXISTS (SELECT 1 FROM budget_items bi WHERE bi.budget_plan_id = bp.id AND bi.account_type = 'income' AND bi.account_prefix LIKE '215%');

-- Dodanie konta 215 (Pożyczki Wn) jako koszt
INSERT INTO budget_items (budget_plan_id, account_type, account_prefix, account_name, planned_amount, forecasted_amount, previous_year_amount)
SELECT bp.id, 'expense', '215-' || l.location_identifier, 'Pożyczki (Wn)', 0, 0, 0
FROM budget_plans bp JOIN locations l ON l.id = bp.location_id
WHERE NOT EXISTS (SELECT 1 FROM budget_items bi WHERE bi.budget_plan_id = bp.id AND bi.account_type = 'expense' AND bi.account_prefix LIKE '215%');
