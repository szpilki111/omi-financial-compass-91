

## Plan naprawy: Budżet (2 paski + roczny) + Dialog zamykający się przy zmianie karty

### Problem 1: Budżet — nieprawidłowe paski realizacji

**Obecny stan**: `BudgetRealizationBar` ma jeden pasek per miesiąc, który liczy tylko rozchody (debit_amount) bez filtrowania po kontach 4xx. Brak paska przychodów (7xx). Brak paska rocznego.

**Plan zmian**:

**`src/utils/budgetUtils.ts`** — nowa funkcja `getBudgetRealizationForMonthDetailed`:
- Pobiera transakcje za dany miesiąc z filtrami: konta 4xx (rozchody, debit_amount) i konta 7xx (przychody, credit_amount)
- Dołącza do transakcji relację `accounts` lub filtruje po `debit_account_id LIKE '4%'` i `credit_account_id LIKE '7%'`
- Zwraca: `{ expenseActual, incomeActual, expensePercentage, incomePercentage, expenseStatus, incomeStatus }`

**`src/pages/Budget/BudgetRealizationBar.tsx`** — przebudowa komponentu:
1. **Pasek roczny na górze**: Suma wszystkich wydatków 4xx z roku vs. suma zaplanowana (totalExpenseBudget). Jeden duży progress bar z procentem i statusem.
2. **Per miesiąc — 2 paski**:
   - Pasek rozchodów (4xx): `monthlyExpenseBudget = totalExpenseBudget / 12` vs. faktyczne wydatki na kontach 4xx
   - Pasek przychodów (7xx): `monthlyIncomeBudget = totalIncomeBudget / 12` vs. faktyczne przychody na kontach 7xx
   - Kolorystyka: rozchody (czerwona gamma), przychody (zielona/niebieska gamma)
3. Budżety miesięczne liczone oddzielnie: `totalIncomeBudget` z `budgetItems.filter(account_type === 'income')`, `totalExpenseBudget` z `budgetItems.filter(account_type === 'expense')`

**Logika filtrowania transakcji** (w nowej funkcji):
- Rozchody: `debit_account_id LIKE '4%'` → suma `debit_amount`
- Przychody: `credit_account_id LIKE '7%'` → suma `credit_amount`
- Zapewnia to precyzyjne liczenie tylko właściwych kont, zamiast sumowania wszystkich debit_amount

---

### Problem 2: Dialog dokumentu zamyka się przy zmianie karty

**Przyczyna**: Gdy użytkownik wraca na kartę, Supabase może wyemitować event `SIGNED_IN` (nie tylko `TOKEN_REFRESHED`). W `AuthContext` event `SIGNED_IN` ustawia `setIsLoading(true)` (linia 165). `ProtectedRoute` widzi `isLoading=true` → renderuje spinner → `DocumentsPage` jest odmontowana → stan `isDialogOpen` jest tracony → dialog znika.

**Fix w `src/context/AuthContext.tsx`**:
- W handlerze `onAuthStateChange`, dla eventów `SIGNED_IN` i `TOKEN_REFRESHED`: jeśli `user` już istnieje (użytkownik jest zalogowany), wykonaj cichy refresh profilu **bez** `setIsLoading(true)`. Ustawienie loading na true jest potrzebne tylko przy pierwszym logowaniu.

```
if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && user)) {
  // Silent refresh — don't unmount the page
  setTimeout(() => fetchUserProfile(currentSession.user.id), 0);
  return;
}
```

Dodatkowo w `fetchUserProfile`: nie wywoływać `setIsLoading(false)` gdy loading jest już false (guard).

---

### Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `src/utils/budgetUtils.ts` | Nowa funkcja pobierająca realizację z podziałem na konta 4xx/7xx |
| `src/pages/Budget/BudgetRealizationBar.tsx` | Przebudowa: pasek roczny + 2 paski/miesiąc (koszty + przychody) |
| `src/context/AuthContext.tsx` | Cichy refresh dla `SIGNED_IN` gdy user już zalogowany |

