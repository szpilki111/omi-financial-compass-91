
# Plan naprawy: 4 problemy z raportami miesięcznymi

## Podsumowanie zgłoszonych problemów

1. **Nazwy kont na raporcie są hardcoded** - Np. konto 402 w bazie nazywa się "Poczta", ale w raporcie pokazuje "Alkohol"
2. **Brak funkcji odblokowania raportu przez admina** - Zatwierdzony raport nie może być cofnięty do edycji
3. **Brak automatycznego pobierania salda otwarcia** - Raport nie pobiera końcowego salda z poprzedniego miesiąca
4. **Raport za styczeń bierze dane z poprzednich miesięcy** - Powinien brać tylko dane za styczeń

---

## Analiza techniczna

### Problem 1: Hardcoded nazwy kont

**Lokalizacja problemu:**
- `ReportIncomeSection.tsx` - linia 5-32: `INCOME_ACCOUNTS` array z hardcoded nazwami
- `ReportExpenseSection.tsx` - linia 5-52: `EXPENSE_ACCOUNTS` array z hardcoded nazwami  
- `ExportToExcelFull.tsx` - linie 14-92: te same hardcoded tablice

**Dowód:**
```sql
-- Zapytanie pokazało:
SELECT number, name FROM accounts WHERE number LIKE '402%'
→ 402-1: "Poczta", 402-2-1: "Poczta", itd.
-- A w kodzie jest: { number: '402', name: 'Alkohol' }
```

**Rozwiązanie:** Pobrać nazwy kont z bazy danych zamiast używać hardcoded tablicy

### Problem 2: Brak odblokowania raportu

**Lokalizacja problemu:**
- `ReportApprovalActions.tsx` - brak przycisku "Odblokuj" dla admina
- `ReportDetails.tsx` - linia 127: `isReportLocked = status === 'submitted' || status === 'approved'`

**Rozwiązanie:** Dodać przycisk "Cofnij zatwierdzenie" widoczny tylko dla admina gdy raport jest zatwierdzony

### Problem 3: Saldo otwarcia nie jest pobierane

**Lokalizacja problemu:**
- `ReportViewFull.tsx` - linie 180-212: pobiera `report_details` z poprzedniego raportu ale:
  - Używa tylko `closing_balance` który często jest 0
  - Nie oblicza rzeczywistego stanu końcowego kont 1xx z transakcji

**Dowód:**
```sql
SELECT opening_balance, closing_balance FROM report_details WHERE report_id = '...'
→ opening_balance: 0, closing_balance: 0 (dane nie są prawidłowo zapisywane)
```

**Rozwiązanie:** Obliczać saldo otwarcia na podstawie skumulowanych obrotów kont 1xx do końca poprzedniego miesiąca

### Problem 4: Dane z poprzednich miesięcy

**Lokalizacja problemu:**
- `ReportViewFull.tsx` - linie 36-51: zapytanie używa `gte('date', dateFrom)` i `lte('date', dateTo)` 
- To powinno działać poprawnie... ale sprawdzenie danych pokazuje że działa OK

**Weryfikacja:** Sprawdziłem i filtry dat działają poprawnie. Problem może być w wyświetlaniu salda otwarcia które jest obliczane na podstawie całej historii.

---

## Plan implementacji

### Krok 1: Napraw błąd buildu (ExportToExcel.tsx)
```typescript
// Linia 233 - zmienić variant="transparent" na variant="outline"
return <Button variant="outline"></Button>;
```

### Krok 2: Pobieraj nazwy kont z bazy danych

**Modyfikacja `ReportViewFull.tsx`:**
```typescript
// Dodać nowe zapytanie o konta z bazy:
const { data: dbAccounts } = useQuery({
  queryKey: ['accounts-for-report', locationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('number, name')
      .or('number.like.4%,number.like.7%');
    if (error) throw error;
    return data;
  }
});

// Funkcja do uzyskania nazwy konta z bazy:
const getAccountName = (prefix: string): string => {
  // Szukaj dokładnego dopasowania lub pierwszego konta pasującego do prefiksu
  const exactMatch = dbAccounts?.find(acc => acc.number === prefix);
  if (exactMatch) return exactMatch.name;
  
  const prefixMatch = dbAccounts?.find(acc => acc.number.startsWith(prefix + '-'));
  return prefixMatch?.name || prefix;
};
```

**Modyfikacja `ReportIncomeSection.tsx` i `ReportExpenseSection.tsx`:**
- Dodać prop `accountNames: Map<string, string>` pobierany z bazy
- Używać przekazanej mapy zamiast hardcoded tablicy
- Fallback do prefiksu jeśli brak nazwy w bazie

**Modyfikacja `ExportToExcelFull.tsx`:**
- Pobierać nazwy kont przed eksportem
- Zastąpić hardcoded `INCOME_ACCOUNTS` i `EXPENSE_ACCOUNTS` danymi z bazy

### Krok 3: Dodaj przycisk "Odblokuj raport" dla admina

**Modyfikacja `ReportApprovalActions.tsx`:**
```typescript
// Dodać nową funkcję:
const handleUnlock = async () => {
  const { error } = await supabase
    .from('reports')
    .update({
      status: 'draft',
      reviewed_at: null,
      reviewed_by: null,
      comments: null
    })
    .eq('id', reportId);
    
  // Odblokuj też dokumenty (usuń validation_errors z locked_by_report)
  await supabase
    .from('documents')
    .update({ validation_errors: null })
    .eq('location_id', locationId)
    .gte('document_date', startDateStr)
    .lte('document_date', endDateStr);
};
```

**Modyfikacja `ReportDetails.tsx`:**
- Dodać sekcję dla admina gdy raport jest zatwierdzony:
```tsx
{canApproveReports && report?.status === 'approved' && (
  <Card>
    <CardContent>
      <Button onClick={handleUnlock} variant="outline">
        <Unlock className="mr-2 h-4 w-4" />
        Odblokuj raport do edycji
      </Button>
    </CardContent>
  </Card>
)}
```

### Krok 4: Napraw pobieranie salda otwarcia

**Modyfikacja `ReportViewFull.tsx`:**
```typescript
// Nowe zapytanie o skumulowane obroty do końca poprzedniego miesiąca:
const { data: openingBalances } = useQuery({
  queryKey: ['report-opening-balances', locationId, month, year],
  queryFn: async () => {
    // Oblicz datę końca poprzedniego miesiąca
    const prevMonthEnd = month === 1 
      ? new Date(year - 1, 11, 31) 
      : new Date(year, month - 1, 0);
    const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0];

    // Pobierz WSZYSTKIE transakcje do końca poprzedniego miesiąca
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select(`
        debit_amount, credit_amount,
        debit_account:accounts!transactions_debit_account_id_fkey(number),
        credit_account:accounts!transactions_credit_account_id_fkey(number)
      `)
      .eq('location_id', locationId)
      .lte('date', prevMonthEndStr);

    // Oblicz skumulowane saldo dla każdej kategorii kont 1xx, 2xx
    const balances = new Map<string, number>();
    
    allTransactions?.forEach(tx => {
      // Dla kont 1xx: saldo = suma Wn - suma Ma
      if (tx.debit_account?.number?.startsWith('1')) {
        const prefix = tx.debit_account.number.split('-')[0];
        balances.set(prefix, (balances.get(prefix) || 0) + (tx.debit_amount || 0));
      }
      if (tx.credit_account?.number?.startsWith('1')) {
        const prefix = tx.credit_account.number.split('-')[0];
        balances.set(prefix, (balances.get(prefix) || 0) - (tx.credit_amount || 0));
      }
      // Analogicznie dla 2xx...
    });

    return { 
      financialBalances: balances,
      intentionsBalance: balances.get('210') || 0 
    };
  }
});
```

### Krok 5: Upewnij się że dane są tylko za wybrany miesiąc

**Weryfikacja:** Zapytania w `ReportViewFull.tsx` już używają poprawnych filtrów `.gte('date', dateFrom).lte('date', dateTo)`.

Problem mógł być w tym, że `openingBalances` (saldo z poprzedniego miesiąca) było błędnie interpretowane jako dane bieżącego miesiąca. Rozwiązanie z kroku 4 to naprawia.

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/components/reports/ExportToExcel.tsx` | Napraw variant="transparent" |
| `src/components/reports/ReportViewFull.tsx` | Pobierz nazwy kont z bazy, napraw saldo otwarcia |
| `src/components/reports/ReportIncomeSection.tsx` | Przyjmij nazwy kont jako prop zamiast hardcoded |
| `src/components/reports/ReportExpenseSection.tsx` | Przyjmij nazwy kont jako prop zamiast hardcoded |
| `src/components/reports/ExportToExcelFull.tsx` | Pobierz nazwy kont z bazy przed eksportem |
| `src/components/reports/ReportApprovalActions.tsx` | Dodaj funkcję odblokowania raportu |
| `src/pages/Reports/ReportDetails.tsx` | Dodaj przycisk "Odblokuj" dla admina |

---

## Diagram przepływu - Odblokowanie raportu

```text
Admin widzi zatwierdzony raport
         ↓
Klika "Odblokuj raport"
         ↓
┌─────────────────────────────────────┐
│ 1. UPDATE reports SET status='draft'│
│ 2. Wyczyść reviewed_at, reviewed_by │
│ 3. UPDATE documents - usuń blokadę  │
└─────────────────────────────────────┘
         ↓
Raport wraca do statusu "Roboczy"
         ↓
Ekonom może edytować dokumenty
```

---

## Diagram przepływu - Saldo otwarcia

```text
Użytkownik otwiera raport za STYCZEŃ 2026
         ↓
System pobiera:
1. Transakcje TYLKO za styczeń 2026 (bieżące obroty)
2. Skumulowane obroty do 31.12.2025 (saldo otwarcia)
         ↓
┌─────────────────────────────────────────────┐
│ Saldo otwarcia dla kasy (100-109):          │
│   = Σ(Wn) - Σ(Ma) dla wszystkich tx         │
│     gdzie date ≤ 2025-12-31                 │
└─────────────────────────────────────────────┘
         ↓
Wyświetl w tabeli:
| Kasa domu | Początek: X | Uznania: Y | Obciążenia: Z | Koniec: X+Y-Z |
```

---

## Szacowany czas realizacji

| Etap | Czas |
|------|------|
| Naprawa błędu buildu | 5 min |
| Pobieranie nazw kont z bazy | 1.5h |
| Przycisk odblokowania raportu | 1h |
| Naprawa salda otwarcia | 2h |
| Testy i poprawki | 1h |
| **Razem** | **~5.5 godzin** |
