
# Plan zmian w aplikacji - 13 punktów

## Podsumowanie zmian

Poniżej znajduje się szczegółowy plan implementacji 13 zmian zgłoszonych przez użytkownika, obejmujących:
- Hardcoding nazw kont w raportach (punkt 1)
- Automatyczna zmiana numeru dokumentu przy edycji (punkt 2)
- Rozbudowa podsumowania w wyszukiwaniu kont (punkty 3, 4, 12)
- Naprawa raportu grudniowego (punkt 5)
- Naprawa tworzenia dokumentów z rozbitych operacji (punkt 6)
- Naprawa wielopoziomowych kont analitycznych (punkty 7, 8, 9, 10)
- Formatowanie kwot z separatorem tysięcy od 4 cyfr (punkt 11)
- Polskie nazwy dni/miesięcy w kalendarzu (punkt 13)

---

## Punkt 1: Hardcoding nazw kont w raportach

### Opis problemu
Obecnie system pobiera nazwy kont dynamicznie z bazy danych. Użytkownik chce zahardcodować nazwy kont, ponieważ nigdy się nie zmienią.

### Pliki do modyfikacji
- `src/components/reports/ReportIncomeSection.tsx`
- `src/components/reports/ReportExpenseSection.tsx`
- `src/components/reports/ReportViewFull.tsx`
- `src/components/reports/ExportToExcelFull.tsx`

### Szczegóły implementacji

**1. ReportIncomeSection.tsx i ReportExpenseSection.tsx:**
Dodać statyczne tablice z prefiksami i nazwami kont:

```typescript
// Hardcoded lista kont przychodów
const INCOME_ACCOUNTS = [
  { prefix: '701', name: 'Intencje odprawione' },
  { prefix: '702', name: 'Duszpasterstwo OMI' },
  { prefix: '703', name: 'Duszpasterstwo parafialne' },
  { prefix: '704', name: 'Kolęda' },
  { prefix: '705', name: 'Zastępstwa zagraniczne' },
  { prefix: '706', name: 'Wypominki parafialne' },
  { prefix: '710', name: 'Odsetki i przychody finansowe' },
  { prefix: '711', name: 'Sprzedaż kalendarzy' },
  { prefix: '712', name: 'Dzierżawa' },
  { prefix: '713', name: 'Sprzedaż z działalności gospodarczej' },
  { prefix: '714', name: 'Pensje, emerytury i renty' },
  { prefix: '715', name: 'Zwroty' },
  { prefix: '716', name: 'Usługi, noclegi, rekolektanci' },
  { prefix: '717', name: 'Inne' },
  { prefix: '718', name: 'Usługi działalności gospodarczej' },
  { prefix: '719', name: 'Dzierżawa przechodnia' },
  { prefix: '720', name: 'Ofiary' },
  { prefix: '724', name: 'Msze Wieczyste' },
  { prefix: '725', name: 'Nadzwyczajne przychody' },
  { prefix: '727', name: 'Cmentarz' },
  { prefix: '728', name: 'Różnice kursowe' },
  { prefix: '730', name: 'Sprzedaż majątku trwałego' },
];

// Hardcoded lista kont rozchodów
const EXPENSE_ACCOUNTS = [
  { prefix: '401', name: 'Biurowe' },
  { prefix: '402', name: 'Poczta' },
  { prefix: '403', name: 'Telefony, Internet TV' },
  { prefix: '404', name: 'Reprezentacyjne' },
  { prefix: '405', name: 'Prowizje i opłaty bankowe' },
  { prefix: '406', name: 'Usługi serwisowe' },
  { prefix: '407', name: 'Wywóz śmieci i nieczystości' },
  { prefix: '408', name: 'Ubezpieczenie majątku trwałego' },
  { prefix: '410', name: 'Pralnia, artykuły chemiczne i konserwacja' },
  { prefix: '411', name: 'Podróże komunikacją publiczną' },
  { prefix: '412', name: 'Utrzymanie samochodu oraz zakup nowego' },
  { prefix: '413', name: 'Noclegi' },
  { prefix: '414', name: 'Honoraria duszpasterskie' },
  { prefix: '420', name: 'Pensje osób zatrudnionych' },
  { prefix: '421', name: 'Osobiste, higiena osobista' },
  { prefix: '422', name: 'Formacja pierwsza' },
  { prefix: '423', name: 'Formacja ustawiczna' },
  { prefix: '424', name: 'Leczenie, opieka zdrowotna' },
  { prefix: '430', name: 'Kult' },
  { prefix: '431', name: 'Książki, gazety, czasopisma, prenumeraty' },
  { prefix: '435', name: 'Wakacyjne' },
  { prefix: '439', name: 'Koszty kolędy' },
  { prefix: '440', name: 'Kuchnia i koszty posiłków' },
  { prefix: '441', name: 'Funkcjonowanie salonu' },
  { prefix: '442', name: 'Odzież' },
  { prefix: '443', name: 'Pralnia, prasowalnia, zakupy, sprzęt' },
  { prefix: '444', name: 'Media, energia elektryczna, woda, gaz, ogrzewanie, węgiel' },
  { prefix: '445', name: 'Podatki i opłaty urzędowe' },
  { prefix: '446', name: 'Ogród, park i cmentarz' },
  { prefix: '447', name: 'Usługi działalności gospodarczej' },
  { prefix: '448', name: 'Towary do sprzedaży' },
  { prefix: '449', name: 'Zakup towarów działalności gospodarczej' },
  { prefix: '450', name: 'Inne' },
  { prefix: '451', name: 'Zakupy / remonty zwyczajne' },
  { prefix: '452', name: 'Zakupy / remonty nadzwyczajne' },
  { prefix: '453', name: 'Spotkania delegacje' },
  { prefix: '454', name: 'Scholastykat międzynarodowy' },
  { prefix: '455', name: 'Studia, studenci, szkolenia' },
  { prefix: '456', name: 'Powołania' },
  { prefix: '457', name: 'Apostolat i posługi' },
  { prefix: '458', name: 'Biedni' },
  { prefix: '459', name: 'Misje, pomoc misjonarzom' },
  { prefix: '461', name: 'Kuria diecezjalna' },
  { prefix: '462', name: 'Świadczenia na dom' },
  { prefix: '463', name: 'Świadczenia dla Adm. Generalnej' },
];
```

**2. Usunąć dynamiczne pobieranie z bazy:**
- Usunąć props `accountNamesFromDb` i `accountPrefixesFromDb`
- Usunąć zapytanie o konta z `ReportViewFull.tsx`
- Używać zahardcodowanych list

**3. ExportToExcelFull.tsx:**
- Dodać te same zahardcodowane tablice
- Usunąć dynamiczne pobieranie nazw kont z bazy

---

## Punkt 2: Automatyczna zmiana numeru dokumentu przy edycji

### Opis problemu
Przy tworzeniu nowego dokumentu, zmiana daty automatycznie regeneruje numer dokumentu. Przy edycji istniejącego dokumentu ta funkcja nie działa.

### Plik do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx`

### Szczegóły implementacji

**Obecny stan (linie 591-604):**
```typescript
useEffect(() => {
  if (!document && isOpen) {  // TYLKO dla nowych dokumentów
    const subscription = form.watch((value, { name }) => {
      if (name === "document_date" && value.document_date) {
        generateDocumentNumber(new Date(value.document_date)).then(...);
      }
    });
    return () => subscription.unsubscribe();
  }
}, [document, isOpen, form]);
```

**Rozwiązanie:**
Dodać nowy `useEffect` dla edycji dokumentu, który sprawdza zmianę miesiąca/roku:

```typescript
// Przechowaj oryginalny miesiąc/rok dokumentu
const originalDocumentDate = useRef<{ month: number; year: number } | null>(null);

useEffect(() => {
  if (document) {
    const docDate = new Date(document.document_date);
    originalDocumentDate.current = {
      month: docDate.getMonth(),
      year: docDate.getFullYear()
    };
  } else {
    originalDocumentDate.current = null;
  }
}, [document]);

// Nowy useEffect dla edycji dokumentu
useEffect(() => {
  if (document && isOpen) {
    const subscription = form.watch((value, { name }) => {
      if (name === "document_date" && value.document_date && originalDocumentDate.current) {
        const newDate = new Date(value.document_date);
        const newMonth = newDate.getMonth();
        const newYear = newDate.getFullYear();
        
        // Sprawdź czy zmienił się miesiąc lub rok
        if (newMonth !== originalDocumentDate.current.month || 
            newYear !== originalDocumentDate.current.year) {
          // Wygeneruj nowy numer dokumentu
          generateDocumentNumber(newDate).then((generatedNumber) => {
            if (generatedNumber) {
              form.setValue("document_number", generatedNumber);
              // Zaktualizuj referencję do nowego miesiąca/roku
              originalDocumentDate.current = { month: newMonth, year: newYear };
            }
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  }
}, [document, isOpen, form, user?.location]);
```

---

## Punkt 3: Rozbudowa podsumowania obrotów w wyszukiwaniu kont

### Opis problemu
Podsumowanie obrotów ma zawierać: Saldo początkowe, Obroty Wn, Obroty Ma, Saldo końcowe. Saldo początkowe ma się brać z poprzedniego okresu.

### Pliki do modyfikacji
- `src/pages/AccountSearch/AccountSearchPage.tsx`
- `src/pages/AccountSearch/MonthlyTurnoverView.tsx`

### Szczegóły implementacji

**AccountSearchPage.tsx - rozszerzyć obiekt `totals`:**
```typescript
const totals = useMemo(() => {
  if (!transactions || !selectedAccount) return { 
    debit: 0, 
    credit: 0, 
    balance: 0,
    openingBalance: 0,
    closingBalance: 0
  };
  
  let debitTotal = 0;
  let creditTotal = 0;
  
  transactions.forEach(transaction => {
    if (transaction.debit_account_id === selectedAccount.id) {
      debitTotal += transaction.debit_amount ?? transaction.amount ?? 0;
    }
    if (transaction.credit_account_id === selectedAccount.id) {
      creditTotal += transaction.credit_amount ?? transaction.amount ?? 0;
    }
  });
  
  const openingBalance = openingBalanceForYear;
  const closingBalance = openingBalance + debitTotal - creditTotal;
  
  return {
    debit: debitTotal,
    credit: creditTotal,
    balance: debitTotal - creditTotal,
    openingBalance,
    closingBalance
  };
}, [transactions, selectedAccount, openingBalanceForYear]);
```

**MonthlyTurnoverView.tsx - podsumowanie dla każdego okresu (miesiąca/kwartału):**
Już zaimplementowane prawidłowo - każdy miesiąc pokazuje saldo początkowe i końcowe dla kont bilansowych (0xx, 1xx, 2xx).

---

## Punkt 4: Pasek podsumowania na górze i dole

### Opis problemu
Pasek z podsumowaniem (saldo początkowe, obroty Wn/Ma, saldo końcowe) ma być widoczny zarówno nad operacjami jak i pod nimi.

### Plik do modyfikacji
- `src/pages/AccountSearch/AccountSearchPage.tsx`

### Szczegóły implementacji

**Wydzielić komponent podsumowania:**
```typescript
const SummaryCard = () => (
  <Card>
    <CardContent className="pt-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-sm text-gray-600">Saldo początkowe</p>
          <p className={`text-2xl font-bold ${totals.openingBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(totals.openingBalance)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Obroty Wn</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(totals.debit)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Obroty Ma</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totals.credit)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Saldo końcowe</p>
          <p className={`text-2xl font-bold ${totals.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totals.closingBalance)}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);
```

**Dodać kartę nad listą operacji i pod nią:**
```tsx
{selectedAccount && (
  <>
    {/* Podsumowanie NA GÓRZE */}
    <SummaryCard />
    
    {/* Content based on view mode */}
    {showTurnover ? (
      <MonthlyTurnoverView ... />
    ) : (
      <TransactionsList ... />
    )}
    
    {/* Podsumowanie NA DOLE */}
    <SummaryCard />
  </>
)}
```

---

## Punkt 5: Naprawa raportu grudniowego

### Opis problemu
Raport grudniowy nie zlicza kwot i brak przycisków "Złóż raport" oraz "Przelicz sumy".

### Pliki do modyfikacji
- `src/pages/Reports/ReportDetails.tsx`

### Analiza przyczyny
Obecny kod (linia 137):
```typescript
const shouldShowRecalculateButton = (report?.status === 'draft' || report?.status === 'to_be_corrected') && hasCalculatedSums;
```

Problem: `hasCalculatedSums` musi być `true` aby pokazać przycisk. Ale dla nowego raportu (gdzie wszystko jest 0) przycisk się nie pokazuje!

Warunek na linii 371:
```typescript
{(report.status === 'draft' || canResubmit) && user?.role === 'ekonom' && (...)}
```

Przycisk "Złóż raport" pokazuje się tylko dla ekonoma gdy status to 'draft'.

### Szczegóły implementacji

**1. Zmienić warunek dla przycisku "Przelicz sumy":**
```typescript
// PRZED:
const shouldShowRecalculateButton = (report?.status === 'draft' || report?.status === 'to_be_corrected') && hasCalculatedSums;

// PO: Pokazuj przycisk zawsze dla draft/to_be_corrected (nawet gdy sumy = 0)
const shouldShowRecalculateButton = report?.status === 'draft' || report?.status === 'to_be_corrected';
```

**2. Dodać przycisk "Złóż raport" obok "Przelicz sumy":**
Przenieść logikę przycisków do wspólnej sekcji dla raportów roboczych.

**3. Sprawdzić logikę obliczania dat dla grudnia:**
Weryfikacja czy `calculateFinancialSummary` poprawnie obsługuje grudzień (miesiąc 12).

---

## Punkt 6: Tworzenie dokumentu z rozbitej operacji

### Opis problemu
Przy tworzeniu dokumentu z wyszukiwania kont dla rozbitej operacji, nowo utworzony dokument ma zablokowaną drugą stronę operacji (tak jak źródłowy dokument).

### Plik do modyfikacji
- `src/pages/AccountSearch/AccountSearchPage.tsx`

### Szczegóły implementacji

**Zmienić handleCreateDocumentFromSelected (linie 313-326):**
```typescript
// PRZED:
const transactionsToInsert = selectedTransactions.map((t, index) => ({
  document_id: newDocument.id,
  date: today.toISOString().split('T')[0],
  description: t.description || '',
  debit_amount: t.debit_amount ?? t.amount ?? 0,
  credit_amount: t.credit_amount ?? t.amount ?? 0,
  debit_account_id: null,  // Brak kont = wymaga uzupełnienia
  credit_account_id: null,
  // ...
}));

// PO: Dla rozbitych operacji ustaw obie kwoty (nie kopiuj zablokowanych stron)
const transactionsToInsert = selectedTransactions.map((t, index) => {
  // Określ która strona była używana w źródłowej transakcji
  const hasDebitAmount = (t.debit_amount ?? 0) > 0;
  const hasCreditAmount = (t.credit_amount ?? 0) > 0;
  
  // Użyj większej kwoty jako wartości dla obu stron
  const amount = Math.max(t.debit_amount ?? 0, t.credit_amount ?? 0);
  
  return {
    document_id: newDocument.id,
    date: today.toISOString().split('T')[0],
    description: t.description || '',
    debit_amount: amount,   // ZAWSZE obie kwoty równe
    credit_amount: amount,  // Nie kopiuj "rozbitej" struktury
    debit_account_id: null,
    credit_account_id: null,
    currency: 'PLN',
    user_id: user.id,
    location_id: user.location,
    display_order: index + 1,
    is_parallel: false
    // NIE kopiuj is_split_transaction, parent_transaction_id itp.
  };
});
```

---

## Punkt 7: Dalsze poziomy analityczne na dokumencie

### Opis problemu
Po rozbiciu operacji, nie można wstawiać kont z dalszymi poziomami analitycznymi (np. 110-2-17-1-1). System wstawia konto syntetyczne (110-2-17).

### Plik do modyfikacji
- `src/pages/Documents/AccountCombobox.tsx`
- `src/hooks/useFilteredAccounts.ts`

### Analiza przyczyny
Funkcja `has_analytics` w bazie danych może niepoprawnie oznaczać konta wielopoziomowe. Potrzeba sprawdzić czy konto nadrzędne (np. 110-2-17-1) jest poprawnie rozpoznawane gdy ma podkonto 110-2-17-1-1.

### Szczegóły implementacji

**1. Sprawdzić funkcję SQL `get_user_filtered_accounts_with_analytics`:**
Upewnić się, że flaga `has_analytics` jest ustawiana poprawnie dla wszystkich poziomów zagłębienia.

**2. AccountCombobox.tsx - naprawić filtrowanie:**
```typescript
// Obecny kod (linia 78-83):
filtered = filtered.filter(account => !account.has_analytics);

// Problem: has_analytics może nie być ustawione dla głębszych poziomów
// Rozwiązanie: Sprawdzić czy istnieje jakiekolwiek konto zaczynające się od "account.number-"
```

**3. Upewnić się, że przy wyborze konta jest zwracane pełne ID:**
```typescript
onSelect={(currentValue) => {
  // currentValue to account.id - upewnij się że jest przekazywane poprawnie
  onChange(currentValue === value ? '' : currentValue);
  // ...
}
```

---

## Punkt 8: Import CSV nie wstawia kolejnych poziomów kont

### Opis problemu
Przy imporcie CSV z numerem konta np. 110-2-17-1, system rozpoznaje go w podglądzie, ale po imporcie wstawia konto syntetyczne 110-2-17.

### Plik do modyfikacji
- `src/pages/Documents/CsvImportDialog.tsx`

### Analiza przyczyny (linie 269-280)
```typescript
const debitAccount = accounts.find(acc => 
  acc.number === debitAccountNumber || 
  acc.number.startsWith(debitAccountNumber) ||
  debitAccountNumber.startsWith(acc.number)  // <-- PROBLEM!
);
```

Warunek `debitAccountNumber.startsWith(acc.number)` zwraca `true` dla 110-2-17 gdy szukamy 110-2-17-1, bo "110-2-17-1".startsWith("110-2-17") = true!

### Szczegóły implementacji

**Naprawić logikę dopasowania kont:**
```typescript
// PRZED:
const debitAccount = accounts.find(acc => 
  acc.number === debitAccountNumber || 
  acc.number.startsWith(debitAccountNumber) ||
  debitAccountNumber.startsWith(acc.number)  // ŹLE!
);

// PO: Priorytet dla dokładnego dopasowania
const findAccount = (accountNumber: string) => {
  // 1. Szukaj dokładnego dopasowania
  const exactMatch = accounts.find(acc => acc.number === accountNumber);
  if (exactMatch) return exactMatch;
  
  // 2. Jeśli nie ma dokładnego, szukaj najdłuższego pasującego prefiksu
  // (ale tylko jeśli accountNumber jest dłuższy od numeru konta)
  const matchingByPrefix = accounts
    .filter(acc => accountNumber.startsWith(acc.number + '-'))
    .sort((a, b) => b.number.length - a.number.length); // Najdłuższy najpierw
  
  return matchingByPrefix[0] || null;
};

const debitAccount = findAccount(debitAccountNumber);
const creditAccount = findAccount(creditAccountNumber);
```

---

## Punkt 9: Blokada kont nadrzędnych wielopoziomowo

### Opis problemu
System blokuje wybór konta nadrzędnego tylko na pierwszym poziomie. Np. od 110-2-17 zrobione 110-2-17-1 blokuje 110-2-17. Ale gdy od 110-2-17-1 zrobione 110-2-17-1-1, to 110-2-17-1 jest nadal dostępne.

### Pliki do modyfikacji
- Funkcja SQL `get_user_filtered_accounts_with_analytics` w bazie danych
- Alternatywnie: `src/hooks/useFilteredAccounts.ts`

### Szczegóły implementacji

**Rozwiązanie w SQL (preferowane):**
Zmodyfikować funkcję `get_user_filtered_accounts_with_analytics` aby sprawdzała czy istnieje JAKIEKOLWIEK konto zaczynające się od `account.number || '-'`:

```sql
-- Dla każdego konta sprawdź czy istnieje podkonto
SELECT 
  a.*,
  EXISTS (
    SELECT 1 FROM accounts sub 
    WHERE sub.number LIKE (a.number || '-%')
    AND sub.is_active = true
  ) as has_analytics
FROM accounts a
WHERE ...
```

**Rozwiązanie w kodzie TypeScript (alternatywne):**
W `useFilteredAccounts.ts` dodać dodatkowe przetwarzanie:

```typescript
// Po pobraniu kont z bazy, dynamicznie ustaw has_analytics
const processedAccounts = allAccounts.map(acc => {
  const hasSubAccounts = allAccounts.some(sub => 
    sub.number.startsWith(acc.number + '-')
  );
  return {
    ...acc,
    has_analytics: hasSubAccounts || acc.has_analytics
  };
});
```

---

## Punkt 10: Blokada tworzenia analityki gdy są operacje

### Opis problemu
Analityka może być tworzona tylko na kontach bez żadnych operacji. Jeśli są operacje, powinien pojawić się komunikat o konieczności ich usunięcia.

### Plik do modyfikacji
- `src/pages/Settings/AccountsSettingsTab.tsx`
- `src/components/AnalyticalAccountDialog.tsx`

### Szczegóły implementacji

**1. AccountsSettingsTab.tsx - sprawdzenie przed otwarciem dialogu:**
```typescript
const handleAddAnalytical = async (account: FilteredAccount) => {
  // Sprawdź czy konto ma jakiekolwiek operacje
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id')
    .or(`debit_account_id.eq.${account.id},credit_account_id.eq.${account.id}`)
    .limit(1);
  
  if (transactions && transactions.length > 0) {
    toast.error(
      'Nie można dodać analityki do konta z operacjami. ' +
      'Najpierw usuń lub przenieś wszystkie operacje z tego konta.'
    );
    return;
  }
  
  // Kontynuuj otwieranie dialogu
  setEditMode(false);
  setEditingAnalytical(null);
  setSelectedAccount(account);
  setDialogOpen(true);
};
```

**2. Dodać zapytanie o liczbę transakcji dla każdego konta (opcjonalnie):**
Wyświetlać ikonę ostrzeżenia przy kontach z operacjami.

---

## Punkt 11: Formatowanie kwot z separatorem tysięcy od 4 cyfr

### Opis problemu
System formatuje kwoty z separatorem tysięcy dopiero od 5 cyfr (10 000), a powinno być od 4 cyfr (1 000).

### Pliki do modyfikacji
Wszystkie miejsca gdzie używany jest `toLocaleString`:
- `src/components/reports/ReportIncomeSection.tsx`
- `src/components/reports/ReportExpenseSection.tsx`
- `src/pages/AccountSearch/AccountSearchPage.tsx`
- `src/pages/AccountSearch/MonthlyTurnoverView.tsx`
- `src/pages/Reports/ReportDetails.tsx`
- I inne pliki z formatowaniem walut

### Analiza
Metoda `toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })` automatycznie dodaje separator tysięcy zgodnie z polską konwencją (spacja). Problem może być w niestandardowej funkcji formatowania.

### Szczegóły implementacji

**Stworzyć centralną funkcję formatowania:**
```typescript
// src/utils/formatUtils.ts
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true  // Wymusza separatory tysięcy
  }).format(value);
};

// Dla kwot bez symbolu waluty (tylko liczba ze spacjami)
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(value);
};
```

**Sprawdzić ustawienia Intl:**
Polski format powinien automatycznie dawać: 1 000,00 zł dla 1000.

---

## Punkt 12: Podsumowanie obrotów kont analitycznych

### Opis problemu
Gdy w wyszukiwaniu kont wpisze się konto syntetyczne (np. 110-2-17), system powinien pokazać sumę obrotów wszystkich kont analitycznych rozszerzonych z tego konta (110-2-17-1, 110-2-17-2 itd.).

### Pliki do modyfikacji
- `src/pages/AccountSearch/AccountSearchPage.tsx`

### Szczegóły implementacji

**1. Rozszerzyć zapytanie o transakcje:**
```typescript
const { data: transactions, isLoading: transactionsLoading } = useQuery({
  queryKey: ['account-transactions', selectedAccount?.id, selectedAccount?.number, selectedYear],
  queryFn: async () => {
    if (!selectedAccount) return [];
    
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    
    // Pobierz wszystkie konta które zaczynają się od wybranego numeru
    const { data: relatedAccounts } = await supabase
      .from('accounts')
      .select('id')
      .or(`number.eq.${selectedAccount.number},number.like.${selectedAccount.number}-%`);
    
    const accountIds = relatedAccounts?.map(acc => acc.id) || [selectedAccount.id];
    
    // Pobierz transakcje dla wszystkich powiązanych kont
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        document:documents(id, document_number, document_name),
        debitAccount:accounts!transactions_debit_account_id_fkey(...),
        creditAccount:accounts!transactions_credit_account_id_fkey(...)
      `)
      .or(accountIds.map(id => `debit_account_id.eq.${id}`).join(',') + ',' +
          accountIds.map(id => `credit_account_id.eq.${id}`).join(','))
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });
      
    if (error) throw error;
    return data;
  },
  enabled: !!selectedAccount
});
```

**2. Zaktualizować obliczanie sum:**
```typescript
const totals = useMemo(() => {
  if (!transactions || !selectedAccount) return { ... };
  
  // Pobierz wszystkie ID kont które należą do wybranego prefiksu
  const { data: relatedAccounts } = useQuery(...);
  const relatedAccountIds = new Set(relatedAccounts?.map(a => a.id) || [selectedAccount.id]);
  
  let debitTotal = 0;
  let creditTotal = 0;
  
  transactions.forEach(transaction => {
    if (relatedAccountIds.has(transaction.debit_account_id)) {
      debitTotal += transaction.debit_amount ?? transaction.amount ?? 0;
    }
    if (relatedAccountIds.has(transaction.credit_account_id)) {
      creditTotal += transaction.credit_amount ?? transaction.amount ?? 0;
    }
  });
  
  return { debit: debitTotal, credit: creditTotal, balance: debitTotal - creditTotal };
}, [transactions, selectedAccount, relatedAccounts]);
```

---

## Punkt 13: Polskie nazwy dni/miesięcy w kalendarzu

### Opis problemu
Daty na kalendarzu są po angielsku, powinny być po polsku.

### Pliki do modyfikacji
- `src/pages/Calendar/CalendarView.tsx` - już ma `locale={pl}` (linia 46)
- `src/components/ui/calendar.tsx` - brak locale
- `src/components/ui/date-picker.tsx` - już ma `locale: pl` (linia 42)

### Szczegóły implementacji

**1. Calendar.tsx - dodać domyślne locale:**
```typescript
import { pl } from "date-fns/locale";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = pl,  // Dodać domyślne locale
  ...props
}: CalendarProps & { locale?: Locale }) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      // ...
    />
  );
}
```

**2. Sprawdzić CalendarView.tsx:**
Już ma `locale={pl}` więc powinno działać. Jeśli nie działa, sprawdzić czy komponent `Calendar` przekazuje prop `locale` do `DayPicker`.

---

## Podsumowanie plików do modyfikacji

| Punkt | Plik | Priorytet |
|-------|------|-----------|
| 1 | `ReportIncomeSection.tsx`, `ReportExpenseSection.tsx`, `ReportViewFull.tsx`, `ExportToExcelFull.tsx` | WYSOKI |
| 2 | `DocumentDialog.tsx` | WYSOKI |
| 3, 4 | `AccountSearchPage.tsx`, `MonthlyTurnoverView.tsx` | ŚREDNI |
| 5 | `ReportDetails.tsx` | KRYTYCZNY |
| 6 | `AccountSearchPage.tsx` | WYSOKI |
| 7 | `AccountCombobox.tsx`, `useFilteredAccounts.ts` | WYSOKI |
| 8 | `CsvImportDialog.tsx` | WYSOKI |
| 9 | Migracja SQL lub `useFilteredAccounts.ts` | WYSOKI |
| 10 | `AccountsSettingsTab.tsx`, `AnalyticalAccountDialog.tsx` | ŚREDNI |
| 11 | Wszystkie pliki z `formatCurrency` | NISKI |
| 12 | `AccountSearchPage.tsx` | ŚREDNI |
| 13 | `calendar.tsx` | NISKI |

---

## Szacowany czas realizacji

| Punkt | Czas | 
|-------|------|
| 1 - Hardcoding nazw kont | 1h |
| 2 - Numer dokumentu przy edycji | 1h |
| 3, 4 - Podsumowanie obrotów + duplikacja | 1.5h |
| 5 - Raport grudniowy | 1h |
| 6 - Rozbite operacje | 0.5h |
| 7, 8, 9 - Konta analityczne wielopoziomowe | 3h |
| 10 - Blokada analityki | 1h |
| 11 - Formatowanie tysięcy | 1h |
| 12 - Sumowanie kont analitycznych | 1.5h |
| 13 - Polskie daty | 0.5h |
| **RAZEM** | **~12 godzin** |
