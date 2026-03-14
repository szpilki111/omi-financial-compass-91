

## Plan: Poprawka prefiksu konta 201 w bazie danych

### Problem
W tabeli `budget_items` konto "Świadczenia na prowincję" ma stary prefix `201-460-{location_identifier}` (np. `201-460-2-20`), zamiast poprawnego `201-{location_identifier}-1` (np. `201-2-20-1`).

Kod w `budgetUtils.ts` już jest poprawny — `{ prefix: '201', suffix: '1' }` i `buildAccountPrefix` buduje `201-x-x-1`. Problem leży **wyłącznie w danych w bazie** — 14 rekordów z formatem `201-460-*`.

### Rozwiązanie

**Migracja SQL** — jednorazowa aktualizacja danych w tabeli `budget_items`:

```sql
UPDATE budget_items bi
SET account_prefix = '201-' || l.location_identifier || '-1'
FROM budget_plans bp
JOIN locations l ON l.id = bp.location_id
WHERE bi.budget_plan_id = bp.id
  AND bi.account_prefix LIKE '201-460-%';
```

To zamieni np.:
- `201-460-2-20` → `201-2-20-1`
- `201-460-2-3` → `201-2-3-1`
- `201-460-4-1` → `201-4-1-1`

**Brak zmian w kodzie** — cały kod frontendowy już poprawnie obsługuje format `201-x-x-1`.

