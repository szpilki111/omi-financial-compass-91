

## Plan: Dodanie konta 215 do widoku budżetu

### Problem
Konto 215 (Pożyczki) zostało dodane do definicji kont w `budgetUtils.ts`, ale istniejące budżety w bazie nie mają wierszy `budget_items` dla konta 215. Dlatego 215 nie pojawia się w tabelce — bo BudgetView renderuje tylko to, co jest w `budget_items`.

### Rozwiązanie

Dwutorowe podejście: migracja SQL + zabezpieczenie w kodzie.

#### 1. Migracja SQL — nowy plik

Nowy plik `supabase/migrations/20260314100100_*.sql`:
```sql
INSERT INTO budget_items (budget_plan_id, account_type, account_prefix, account_name, planned_amount, forecasted_amount, previous_year_amount)
SELECT bp.id, 'income', '215-' || l.location_identifier, 'Pożyczki (Ma)', 0, 0, 0
FROM budget_plans bp JOIN locations l ON l.id = bp.location_id
WHERE NOT EXISTS (SELECT 1 FROM budget_items bi WHERE bi.budget_plan_id = bp.id AND bi.account_type = 'income' AND bi.account_prefix LIKE '215%');

INSERT INTO budget_items (budget_plan_id, account_type, account_prefix, account_name, planned_amount, forecasted_amount, previous_year_amount)
SELECT bp.id, 'expense', '215-' || l.location_identifier, 'Pożyczki (Wn)', 0, 0, 0
FROM budget_plans bp JOIN locations l ON l.id = bp.location_id
WHERE NOT EXISTS (SELECT 1 FROM budget_items bi WHERE bi.budget_plan_id = bp.id AND bi.account_type = 'expense' AND bi.account_prefix LIKE '215%');
```

#### 2. BudgetView.tsx — zabezpieczenie w kodzie

Zmiana w query (linia 39): dodać `location_identifier` do `locations`:
```
locations(name, location_identifier)
```

Po zbudowaniu `incomeItems` i `expenseItems` (linie 221-249), dodać logikę wstrzykiwania brakujących pozycji 215:

```typescript
// Po linii 249, przed getStatusBadge:
const locationIdentifier = (budget.locations as any)?.location_identifier || '';

// Jeśli brak 215 w przychodach — dodaj
const has215Income = incomeItems.some(i => i.account_prefix.startsWith('215'));
if (!has215Income && locationIdentifier) {
  incomeItems.push({
    account_prefix: `215-${locationIdentifier}`,
    account_name: 'Pożyczki (Ma)',
    forecasted: 0, planned: 0, previous: 0,
    realized: realizationByAccount?.['215-income'] || 0,
  });
}

// Jeśli brak 215 w kosztach — dodaj
const has215Expense = expenseItems.some(i => i.account_prefix.startsWith('215'));
if (!has215Expense && locationIdentifier) {
  expenseItems.push({
    account_prefix: `215-${locationIdentifier}`,
    account_name: 'Pożyczki (Wn)',
    forecasted: 0, planned: 0, previous: 0,
    realized: realizationByAccount?.['215-expense'] || 0,
  });
}
```

To zabezpiecza wyświetlanie 215 nawet gdy migracja jeszcze nie przeszła lub budżet został utworzony przed dodaniem konta 215.

### Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `supabase/migrations/20260314100100_*.sql` | INSERT brakujących 215 do budget_items |
| `src/pages/Budget/BudgetView.tsx` | Dodać location_identifier do query + wstrzykiwanie 215 gdy brak |

