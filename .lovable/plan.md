

## Problem: Kwoty ujemne nie wyświetlają się w widoku transakcji i eksporcie Excel

### Przyczyna

W **trzech miejscach** kwoty ujemne są odfiltrowane przez warunki `> 0` lub truthy check:

1. **`TransactionsList.tsx`** (linie 244, 256):
   - `{debitAmount > 0 && ...}` — kwota -900 nie spełnia warunku `> 0`, więc nic się nie wyświetla
   - `{creditAmount > 0 && ...}` — analogicznie dla strony Ma

2. **`AccountSearchPage.tsx` — eksport Excel** (linie 515-516):
   - `debitAmount ? ... : ''` — wartość `0` jest falsy, ale ujemna kwota (-900) jest truthy, więc tu **akurat działa** dla ujemnych. Ale `0` nie pojawi się nigdy.
   - Jednak po głębszej analizie: `debitAmount` wynosi 0 gdy `isDebit` jest false, a ujemna kwota jest poprawnie przekazywana. Ten fragment jest OK.

3. **Obliczanie sum w `totals` i `monthlyData`** — te dodają wartości bezwarunkowo (linie 229-237, 304-309), więc sumy są poprawne nawet dla kwot ujemnych.

### Rozwiązanie

**Plik: `src/pages/AccountSearch/TransactionsList.tsx`**

Zmienić warunki wyświetlania kwot z `> 0` na `!== 0`:

- Linia 244: `{debitAmount > 0 && (` → `{debitAmount !== 0 && (`
- Linia 256: `{creditAmount > 0 && (` → `{creditAmount !== 0 && (`

Dodatkowo, dla kwot ujemnych styl powinien się zachować — kwoty ujemne po stronie Wn nadal wyświetlą się na czerwono (`text-destructive`), a po stronie Ma na zielono (`text-green-600`), co jest spójne z obecną konwencją kolorystyczną.

### Weryfikacja pozostałych miejsc

- **MonthlyTurnoverView.tsx** — wyświetla `formatCurrency(monthData.debit)` bezwarunkowo → OK
- **financeUtils.ts** — ma warunek `if (rawAmount > 0)` (linie 96, 104) do zliczania przychodów/kosztów. To jest **poprawne** w kontekście raportów finansowych — korekty ujemne powinny zmniejszać sumę przychodu/kosztu, ale ten warunek je pomija. Jednak to osobny temat (korekty w raportach), nie zgłoszony przez użytkownika.
- **KpirTable.tsx** — wyświetla kwoty bezwarunkowo przez `formatAmount()` → OK

### Zakres zmian
Jeden plik, dwie linie — zmiana warunku z `> 0` na `!== 0`.

