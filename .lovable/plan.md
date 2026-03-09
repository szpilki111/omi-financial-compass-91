

## Plan: Ograniczenie konta 463 + Przebudowa widoku budżetu

### 1. Konto 463 — ograniczenie do administracji prowincjalnej

**Diagnoza**: Konto 463 jest już oznaczone jako `is_restricted: true` dla kategorii 2, 3, 4, 5 w tabeli `account_category_restrictions`. Funkcja RPC `get_user_filtered_accounts_with_analytics` filtruje te konta w selektorze UI. Jednak konto `463-2-20` fizycznie istnieje w tabeli `accounts` — prawdopodobnie transakcje zostały dodane przez administratora (admin omija ograniczenia) lub przed wdrożeniem ograniczeń.

**Rozwiązanie**: Dodać walidację server-side w `AccountCombobox.tsx` i/lub `TransactionForm.tsx` — ostrzeżenie/blokada przy próbie użycia konta 463 przez użytkownika spoza kategorii 1 (Prowincja). Dodatkowo, jeśli admin księguje na placówkę inną niż prowincjalna, wyświetlić ostrzeżenie.

**Pliki do zmiany**:
- `src/pages/Documents/TransactionForm.tsx` — dodać walidację przy wyborze konta 463 dla lokalizacji spoza kategorii 1

---

### 2a. Realizacja budżetu rocznego — dwa paski (przychody + koszty)

**Obecny stan**: Jeden pasek roczny (tylko koszty 4xx).

**Zmiana**: Dodać drugi pasek roczny dla przychodów (7xx). W `BudgetRealizationBar.tsx`:
- Dodać obliczanie `yearlyIncomeActual` (analogicznie do `yearlyExpenseActual`)
- Renderować dwa paski: "Koszty (4xx)" i "Przychody (7xx)"

**Plik**: `src/pages/Budget/BudgetRealizationBar.tsx`

---

### 2b. Usunięcie sekcji "Realizacja miesięczna"

**Zmiana**: Usunąć cały blok `Card` z "Realizacja miesięczna {year}" (linie 148-214 w `BudgetRealizationBar.tsx`). Usunąć zbędne obliczenia miesięczne z `queryFn`.

**Plik**: `src/pages/Budget/BudgetRealizationBar.tsx`

---

### 2c. Tabele Przychody/Rozchody — zamiana "Prognoza" i "Poprz. rok" na "Zrealizowano"

**Obecny stan**: Każda pozycja pokazuje: Prognoza, Budżet, Poprz. rok.

**Zmiana**: Usunąć "Prognoza" i "Poprz. rok". Dodać wiersz "Zrealizowano" pokazujący roczną realizację (sumę transakcji) per konto. Wymaga:
- Rozszerzenia interfejsu `BudgetItem` o pole `realized: number`
- W `BudgetView.tsx`: pobrania danych realizacji (sum transakcji per konto za bieżący rok) i przekazania do `BudgetItemsTable`
- W `BudgetItemsTable.tsx`: usunięcia wierszy "Prognoza" i "Poprz. rok", dodania wiersza "Zrealizowano" z kwotą
- W `BudgetForm.tsx`: usunięcia wyświetlania "Prognoza" i "Poprz. rok" (zostawiając je w danych, ale nie wyświetlając)

**Pliki**: `src/pages/Budget/BudgetItemsTable.tsx`, `src/pages/Budget/BudgetView.tsx`, `src/pages/Budget/BudgetForm.tsx`

---

### 2d. Zmiana konta "201-460-x-x" na "201-x-x-1" w Rozchodach

**Obecny stan**: W `budgetUtils.ts` EXPENSE_ACCOUNTS zawiera `{ prefix: '201-460', name: 'Świadczenia na prowincję' }`.

**Zmiana**: Zamienić prefix na `'201'` z sufiksem `-1` (konto `201-x-x-1`). Dostosować logikę `buildAccountPrefix` i `getAccountBalanceForYear` dla tego specjalnego konta, aby szukać transakcji na koncie `201-{locationIdentifier}-1`.

**Pliki**: `src/utils/budgetUtils.ts`, `src/constants/accountNames.ts` (jeśli 201-460 tam też występuje — nie występuje, tylko w budgetUtils)

---

### Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `src/pages/Documents/TransactionForm.tsx` | Walidacja konta 463 |
| `src/pages/Budget/BudgetRealizationBar.tsx` | 2 paski roczne + usunięcie sekcji miesięcznej |
| `src/pages/Budget/BudgetItemsTable.tsx` | Zamiana Prognoza/Poprz.rok na Zrealizowano |
| `src/pages/Budget/BudgetView.tsx` | Pobranie danych realizacji per konto |
| `src/pages/Budget/BudgetForm.tsx` | Usunięcie wyświetlania Prognoza/Poprz.rok |
| `src/utils/budgetUtils.ts` | Zmiana prefixu 201-460 na 201 z sufiksem -1 |

