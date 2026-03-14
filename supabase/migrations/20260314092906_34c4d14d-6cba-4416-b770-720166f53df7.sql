-- Jednorazowa poprawka prefiksów konta 201 w budget_items
-- Zamiana formatu 201-460-{location_id} na poprawny 201-{location_id}-1
UPDATE budget_items bi
SET account_prefix = '201-' || l.location_identifier || '-1'
FROM budget_plans bp
JOIN locations l ON l.id = bp.location_id
WHERE bi.budget_plan_id = bp.id
  AND bi.account_prefix LIKE '201-460-%';