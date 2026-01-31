

# Plan naprawy: Dynamiczne pobieranie nazw kont z bazy danych

## Podsumowanie problemu

Raporty używają zahardcodowanych list prefiksów kont zamiast pobierać je dynamicznie z bazy danych. Powoduje to:
- Konta bez odpowiednika w bazie (np. 707, 708, 409) pokazują numer zamiast nazwy
- Konta które istnieją w bazie ale nie są w hardcoded liście (np. 439, 460) są pomijane
- Konto 701 pokazuje "701" zamiast "Intencje odprawione"

### Dowód z analizy bazy danych

**Prefiksy przychodów (7xx) w bazie:**
701, 702, 703, 704, 705, 706, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 724, 725, 727, 728, 730

**Hardcoded w raporcie (brakujące w bazie):**
707, 708, 709, 721, 722 - te NIE istnieją w bazie

**Prefiksy kosztów (4xx) w bazie:**
401-408, 410-414, 416, 420-424, 430-431, 435, 439-442, 444-449, 450-459, 460-463

**Hardcoded w raporcie (brakujące w bazie):**
409, 415, 417, 418, 419, 425, 443 - te NIE istnieją w bazie

---

## Rozwiązanie

Zamiast hardcoded listy prefiksów, pobierać dynamicznie z bazy danych unikalne prefiksy kont 4xx i 7xx, i pokazywać **tylko te które istnieją w bazie**.

---

## Szczegóły implementacji

### 1. Modyfikacja ReportViewFull.tsx

**Zmiana w zapytaniu o konta (linie 33-54):**

```typescript
// Zamiast budować mapę prefix -> name z pierwszego znalezionego
// Pobierz WSZYSTKIE unikalne prefiksy i ich nazwy

const { data: accountPrefixes } = useQuery({
  queryKey: ['account-prefixes-for-report', locationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('number, name')
      .or('number.like.4%,number.like.7%');
    if (error) throw error;
    
    // Build maps: prefix -> name, and sets of existing prefixes
    const incomeNames = new Map<string, string>();
    const expenseNames = new Map<string, string>();
    const incomePrefixes = new Set<string>();
    const expensePrefixes = new Set<string>();
    
    data?.forEach(acc => {
      const prefix = acc.number.split('-')[0];
      
      if (prefix.startsWith('7')) {
        incomePrefixes.add(prefix);
        if (!incomeNames.has(prefix)) {
          incomeNames.set(prefix, acc.name);
        }
      } else if (prefix.startsWith('4')) {
        expensePrefixes.add(prefix);
        if (!expenseNames.has(prefix)) {
          expenseNames.set(prefix, acc.name);
        }
      }
    });
    
    // Sort prefixes numerically
    const sortedIncome = Array.from(incomePrefixes).sort((a, b) => parseInt(a) - parseInt(b));
    const sortedExpense = Array.from(expensePrefixes).sort((a, b) => parseInt(a) - parseInt(b));
    
    return {
      incomePrefixes: sortedIncome,
      expensePrefixes: sortedExpense,
      incomeNames,
      expenseNames
    };
  },
  enabled: !!locationId
});
```

**Przekazanie do komponentów:**

```tsx
<ReportIncomeSection 
  accountsData={transactionData?.incomeAccounts || []}
  totalIncome={transactionData?.totalIncome || 0}
  accountNamesFromDb={accountPrefixes?.incomeNames}
  accountPrefixesFromDb={accountPrefixes?.incomePrefixes}  // NOWY PROP
/>

<ReportExpenseSection 
  accountsData={transactionData?.expenseAccounts || []}
  totalExpense={transactionData?.totalExpense || 0}
  accountNamesFromDb={accountPrefixes?.expenseNames}
  accountPrefixesFromDb={accountPrefixes?.expensePrefixes}  // NOWY PROP
/>
```

### 2. Modyfikacja ReportIncomeSection.tsx

**Usunąć hardcoded tablicę i używać dynamicznej:**

```typescript
// USUNĄĆ:
const INCOME_ACCOUNT_PREFIXES = [
  '701', '702', '703', '704', ...
];

// ZMIENIĆ interface:
interface ReportIncomeSectionProps {
  accountsData: AccountData[];
  totalIncome: number;
  className?: string;
  accountNamesFromDb?: Map<string, string>;
  accountPrefixesFromDb?: string[];  // NOWY PROP
}

// ZMIENIĆ render:
const prefixesToRender = accountPrefixesFromDb || [];

// W render:
{prefixesToRender.map((prefix) => {
  const amount = getAccountAmount(prefix);
  const name = accountNamesFromDb?.get(prefix) || prefix;
  return (
    <TableRow key={prefix}>
      <TableCell>{prefix}</TableCell>
      <TableCell>{name}</TableCell>
      <TableCell>{formatCurrency(amount)}</TableCell>
    </TableRow>
  );
})}
```

### 3. Modyfikacja ReportExpenseSection.tsx

**Analogiczne zmiany jak dla przychodów:**

- Usunąć hardcoded `EXPENSE_ACCOUNT_PREFIXES`
- Dodać prop `accountPrefixesFromDb?: string[]`
- Iterować po dynamicznej liście zamiast hardcoded

### 4. Modyfikacja ExportToExcelFull.tsx

**Podobna logika - pobierać dynamicznie:**

```typescript
// W handleExport, po pobraniu dbAccounts:

// Build dynamic lists of prefixes that exist in DB
const incomePrefixes = new Set<string>();
const expensePrefixes = new Set<string>();

dbAccounts?.forEach(acc => {
  const prefix = acc.number.split('-')[0];
  if (prefix.startsWith('7')) incomePrefixes.add(prefix);
  else if (prefix.startsWith('4')) expensePrefixes.add(prefix);
});

const sortedIncomePrefixes = Array.from(incomePrefixes).sort((a, b) => parseInt(a) - parseInt(b));
const sortedExpensePrefixes = Array.from(expensePrefixes).sort((a, b) => parseInt(a) - parseInt(b));

// Użyć sortedIncomePrefixes i sortedExpensePrefixes zamiast INCOME_ACCOUNT_PREFIXES
```

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/components/reports/ReportViewFull.tsx` | Pobieranie unikalnych prefiksów z bazy, przekazanie do komponentów |
| `src/components/reports/ReportIncomeSection.tsx` | Usunięcie hardcoded listy, dynamiczne renderowanie |
| `src/components/reports/ReportExpenseSection.tsx` | Usunięcie hardcoded listy, dynamiczne renderowanie |
| `src/components/reports/ExportToExcelFull.tsx` | Dynamiczne budowanie list prefiksów |

---

## Diagram przepływu danych

```text
┌─────────────────────────────────────────────────────────┐
│ BAZA DANYCH: accounts                                   │
│ 701-2-1 "Intencje odprawione"                           │
│ 701-2-2 "Intencje odprawione"                           │
│ 402-2-1 "Poczta"                                        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Zapytanie: pobierz unikalne prefiksy                    │
│ SELECT DISTINCT split_part(number, '-', 1) as prefix    │
│ GROUP BY prefix                                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Wynik:                                                  │
│ incomePrefixes: [701, 702, 703, 704, 705, 706, 710...]  │
│ incomeNames: Map {701 → "Intencje odprawione", ...}     │
│ expensePrefixes: [401, 402, 403, ...]                   │
│ expenseNames: Map {401 → "Biurowe", 402 → "Poczta",...} │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ RAPORT wyświetla TYLKO konta istniejące w bazie:        │
│ 701 | Intencje odprawione | 1 234,56                    │
│ 702 | Duszpasterstwo OMI  | 567,89                      │
│ ...                                                     │
│ (bez 707, 708, 709 - nie istnieją w bazie)              │
└─────────────────────────────────────────────────────────┘
```

---

## Oczekiwany rezultat

Po implementacji:
- Konto 701 pokaże nazwę "Intencje odprawione" (z bazy)
- Konto 402 pokaże nazwę "Poczta" (z bazy) zamiast "Alkohol"
- Konta 707, 708, 709 nie będą wyświetlane (nie istnieją w bazie)
- Konta 439, 448, 460 itp. zostaną dodane (istnieją w bazie)
- Excel eksport będzie spójny z widokiem raportu

