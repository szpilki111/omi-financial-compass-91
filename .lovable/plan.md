

## Plan: Konto 201/215, sticky header, przeniesienie "Zgłoś błąd"

### 1. Konto 201 — zmiana wyświetlanego prefiksu na `201-x-x-1`

**Problem**: W widoku budżetu (BudgetView) konto świadczeń pokazuje się jako `201-460-2-20` zamiast `201-x-x-1` (z identyfikatorem lokalizacji).

**Analiza**: W `budgetUtils.ts` linia 72 już jest `{ prefix: '201', name: 'Świadczenia na prowincję', suffix: '1' }` i `buildAccountPrefix` buduje `201-{locationIdentifier}-1`. Problem polega na tym, że istniejące rekordy w bazie (`budget_items`) wciąż mają stary `account_prefix: '201-460-2-20'`. Trzeba naprawić:

a) **`BudgetView.tsx` (linia 184)**: Realizacja dla konta 201 — aktualnie zbiera WSZYSTKIE transakcje `201-*` do klucza `'201'`. Trzeba doprecyzować, by zbierał tylko te z sufiksem `-1` (świadczenia na prowincję): `debitNumber.match(/^201-\d+-\d+-1$/)`.

b) **Wyświetlanie prefiksu**: Jeśli dane w bazie mają stary prefix `201-460-2-20`, trzeba albo zrobić migrację SQL, albo w UI mapować stary prefix na nowy. Lepiej poprawić w kodzie wyświetlania — w `BudgetView.tsx` przy mapowaniu `expenseItems` sprawdzać prefix `201` i wyświetlać poprawny.

### 2. Konto 215 — pożyczki (po stronie Ma = przychód, Wn = koszt)

**Zmiany**:

a) **`budgetUtils.ts`**: Dodać konto `215` zarówno do `INCOME_ACCOUNTS` (np. `{ prefix: '215', name: 'Pożyczki (Ma)' }`) jak i do `EXPENSE_ACCOUNTS` (`{ prefix: '215', name: 'Pożyczki (Wn)' }`).

b) **`BudgetView.tsx` realizacja (linie 176-192)**: Dodać logikę dla konta 215:
- Transakcje z kontem `215-*` po stronie **credit** (Ma) → dodaj do realizacji przychodów (`result['215-income']`)
- Transakcje z kontem `215-*` po stronie **debit** (Wn) → dodaj do realizacji kosztów (`result['215-expense']`)

c) **Mapowanie realizacji do pozycji**: W sekcji `incomeItems` i `expenseItems` (linie 209-235) — dla konta 215 po stronie przychodów brać `realizationByAccount['215-income']`, po stronie kosztów `realizationByAccount['215-expense']`.

d) **`BudgetRealizationBar.tsx` (linia 345-356)**: W `getBudgetRealizationForMonthDetailed` dodać zliczanie konta 215:
- `creditNumber.startsWith('215')` → `incomeActual += credit_amount`
- `debitNumber.startsWith('215')` → `expenseActual += debit_amount`

e) **`BudgetForm.tsx`**: Konto 215 pojawi się automatycznie z tablic INCOME/EXPENSE_ACCOUNTS.

### 3. Przeniesienie "Zgłoś błąd" do Headera + sticky header

**Zmiany**:

a) **`src/components/layout/Header.tsx`**: 
- Dodać sticky: zmienić `<header className="bg-white border-b ...">` na `<header className="bg-white border-b ... sticky top-0 z-50">`
- Dodać przycisk "Zgłoś błąd" obok avatara (przed dropdownem)

b) **`src/components/ErrorReportButton.tsx`**: Zmienić z renderowania `fixed bottom-6 right-6` buttona na eksportowanie logiki (captureScreenshot, dialog) w formacie użytecznym z Headera. Można wyeksportować hook lub po prostu przenieść przycisk do Headera.

c) **`src/components/layout/MainLayout.tsx`**: Usunąć `<ErrorReportButton />` z MainLayout (linia 25).

d) **Header**: Dodać `ErrorReportButton` jako mały przycisk (ikona Bug) w pasku nawigacji zamiast floating buttona.

### Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `src/utils/budgetUtils.ts` | Dodać konto 215 do INCOME i EXPENSE, poprawić 201 realizację |
| `src/pages/Budget/BudgetView.tsx` | Realizacja: obsługa 201 z sufiksem -1, konto 215 dwustronnie |
| `src/pages/Budget/BudgetRealizationBar.tsx` | Paski: uwzględnić 201 i 215 w obliczeniach |
| `src/components/layout/Header.tsx` | Sticky top + przycisk "Zgłoś błąd" |
| `src/components/ErrorReportButton.tsx` | Zmienić na komponent inline (bez fixed positioning) |
| `src/components/layout/MainLayout.tsx` | Usunąć ErrorReportButton |

