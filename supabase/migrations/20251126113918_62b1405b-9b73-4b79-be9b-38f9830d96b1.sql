-- Naprawa zahardcodowanych prefiksów kont w budget_items
-- Zamienia '-2-2' na właściwy location_identifier dla każdej lokalizacji

UPDATE budget_items bi
SET account_prefix = REGEXP_REPLACE(
  bi.account_prefix, 
  '-2-2$',  -- znajdź końcówkę -2-2
  '-' || l.location_identifier  -- zamień na właściwy identyfikator lokalizacji
)
FROM budget_plans bp
JOIN locations l ON l.id = bp.location_id
WHERE bi.budget_plan_id = bp.id
AND bi.account_prefix LIKE '%-2-2'
AND l.location_identifier IS NOT NULL
AND l.location_identifier != '2-2';  -- nie zmieniaj dla Gdańska (który ma 2-2)