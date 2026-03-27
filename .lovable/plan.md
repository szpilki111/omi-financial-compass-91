

## Plan: Eksport Excel z wyszukiwarki kont — filtrowanie po miesiącu, kwoty w PLN, mieści się na 1 stronie

### Problem
1. Excel eksportuje **wszystkie miesiące** zamiast tylko wybranego miesiąca
2. Kwoty w Excelu są w **walucie obcej** zamiast w PLN
3. Wydruk nie mieści się na jednej stronie A4

### Rozwiązanie

**Plik: `src/pages/AccountSearch/AccountSearchPage.tsx`** — modyfikacja funkcji `handleExportToExcel` (linie 478-524)

#### 1. Filtrowanie po wybranym miesiącu
Zamiast `[...transactions]` użyć `filteredTransactions` (który już uwzględnia `selectedMonth`). Jeśli miesiąc jest wybrany — eksportujemy tylko ten miesiąc. Jeśli nie — wszystkie (obecne zachowanie).

Nagłówek zmieniony na:
```
selectedMonth ? `Miesiąc: ${selectedMonth}/${selectedYear}` : `Rok: ${selectedYear}`
```

Nazwa pliku uwzględni miesiąc: `obroty_101-1_03-2026.xlsx` zamiast `obroty_101-1_2026.xlsx`.

#### 2. Kwoty w PLN zamiast w walucie obcej
Obecny kod używa `debit_amount` / `credit_amount` (waluta oryginalna). Zmienię na przeliczanie przez `exchangeRate`:
```typescript
const exchangeRate = t.exchange_rate || t.document?.exchange_rate || 1;
const debitAmount = isDebit ? (t.debit_amount ?? t.amount ?? 0) * exchangeRate : 0;
const creditAmount = isCredit ? (t.credit_amount ?? t.amount ?? 0) * exchangeRate : 0;
```
To jest ta sama logika co w `totals` useMemo (linia 228-237).

#### 3. Dopasowanie do jednej strony A4
Użyję `!print` property w XLSX:
- Orientacja: pozioma (landscape)
- Dopasowanie do 1 strony (`fitToPage`, `fitToWidth: 1, fitToHeight: 0`)
- Mniejsze marginesy (0.3 cala)
- Zamrożenie wiersza nagłówkowego

### Efekt
- Użytkownik widzi luty → eksportuje tylko luty
- Kwoty zawsze w PLN (spójne z widokiem na ekranie)
- Excel drukuje się na jednej stronie A4

