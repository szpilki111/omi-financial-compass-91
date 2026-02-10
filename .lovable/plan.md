
# Plan wdrożenia 8 poprawek systemu

## Podsumowanie zadań

| # | Opis | Priorytet | Pliki |
|---|------|-----------|-------|
| 0 | Admin nie widzi kont 149-1, 200-2-8-1 - blad w has_analytics | KRYTYCZNY | `useFilteredAccounts.ts` |
| 1 | Paginacja listy dokumentow dla admina | Wysoki | `DocumentsPage.tsx` |
| 2 | Logistyka szablonow importu CSV | Sredni | `CsvImportDialog.tsx` |
| 3 | Nazwy kont na stronie 2 Excel sie nie mieszcza | Sredni | `ExportToExcelFull.tsx` |
| 4 | Auto-odswiezenie po dodaniu raportu | Niski | `ReportsPage.tsx` |
| 5 | Odrzucony raport nadal blokuje usuwanie dokumentow | Wysoki | `DocumentsPage.tsx` |
| 6 | Dodac waluty CAD, NOK, AUD | Sredni | `CurrencySelector.tsx`, `fetch-nbp-rates` |
| 7 | Podsumowanie walutowe w wyszukiwaniu kont | Sredni | `AccountSearchPage.tsx`, `TransactionsList.tsx` |

---

## 0. Admin nie widzi niektorych kont (KRYTYCZNY)

### Diagnoza

Problem lezy w `useFilteredAccounts.ts` linia 100:

```typescript
has_analytics: hasSubAccounts || (acc.analytical ?? false),
```

Flaga `analytical` oznacza ze konto JEST kontem analitycznym (podkontem), NIE ze ma podkonta. Ale kod traktuje `analytical: true` jako `has_analytics: true`, co powoduje ze AccountCombobox filtruje takie konta (linia w AccountCombobox: `filtered = filtered.filter(account => !account.has_analytics)`).

Konto `200-2-8-1` ma `analytical: true` i nie ma podkont -- powinno byc widoczne, ale jest blokowane.
Konto `149-1` ma `analytical: true` i MA podkonto `149-1-1` -- slusznie ukryte (trzeba wybrac 149-1-1).

### Rozwiazanie

W `useFilteredAccounts.ts` (linie 96-101 i 151-157) zmienic:

```typescript
// PRZED (bledne):
has_analytics: hasSubAccounts || (acc.analytical ?? false),

// PO (poprawne):
has_analytics: hasSubAccounts,
```

Flaga `has_analytics` powinna byc `true` TYLKO gdy konto faktycznie posiada podkonta w systemie. Sam fakt bycia kontem analitycznym (`analytical: true`) nie oznacza ze nie mozna na nim ksiegowac.

### Pliki do modyfikacji
- `src/hooks/useFilteredAccounts.ts` (2 miejsca: linia 100 i linia 156)

---

## 1. Paginacja listy dokumentow dla admina

### Problem
`DocumentsPage.tsx` pobiera WSZYSTKIE dokumenty naraz (brak `.range()`), a potem dla kazdego robi dodatkowe zapytanie o transakcje (N+1 problem). Dla admina z dostepem do wszystkich lokalizacji to moze byc setki dokumentow.

### Rozwiazanie

1. Dodac `currentPage` i `pageSize = 50` state
2. Uzyc `.range(from, to)` z `{ count: 'exact' }` w zapytaniu glownym
3. Zoptymalizowac N+1: zamiast osobnego zapytania per dokument, pobrac transakcje hurtowo
4. Dodac komponent paginacji na dole listy

```typescript
const [currentPage, setCurrentPage] = useState(1);
const PAGE_SIZE = 50;

// W queryFn:
const from = (currentPage - 1) * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

const { data, count, error } = await supabase
  .from('documents')
  .select('*, locations(name), profiles!documents_user_id_fkey(name)', { count: 'exact' })
  .order('document_number', { ascending: false })
  .range(from, to);

// Pobierz transakcje hurtowo dla wszystkich dokumentow na stronie
const docIds = data.map(d => d.id);
const { data: allTransactions } = await supabase
  .from('transactions')
  .select('document_id, debit_amount, credit_amount, amount, currency, exchange_rate')
  .in('document_id', docIds);

// Grupuj po document_id i oblicz sumy
```

5. Dodac `queryKey: ['documents', currentPage, selectedLocationId]`
6. Wyswietlic nawigacje stron: "Strona X z Y" + przyciski Poprzednia/Nastepna

### Pliki do modyfikacji
- `src/pages/Documents/DocumentsPage.tsx`

---

## 2. Logistyka szablonow importu CSV

### Problem
Szablon CSV uzywa kont z lokalizacja `1-1` (np. `420-1-1-1`), co nie pasuje do innych lokalizacji. Konta syntetyczne (np. `100`) sa blokowane.

### Rozwiazanie

1. Dynamiczny szablon: pobrac konta uzytkownika i wygenerowac szablon z prawdziwymi numerami kont dla jego lokalizacji
2. Automatyczne mapowanie: jesli uzytkownik poda konto syntetyczne (np. `420`), system szuka konta `420-{location_identifier}` lub `420-{location_identifier}-*`
3. Jesli dla konta syntetycznego istnieje dokladnie 1 konto analityczne, uzyj go automatycznie

```typescript
const resolveAccount = (accountNumber: string): string | null => {
  // Dokladne dopasowanie
  const exact = accounts.find(a => a.number === accountNumber && !a.has_analytics);
  if (exact) return exact.id;
  
  // Szukaj konta z lokalizacja
  const withLocation = accounts.find(a => 
    a.number === `${accountNumber}-${locationIdentifier}` && !a.has_analytics
  );
  if (withLocation) return withLocation.id;
  
  // Szukaj jedynego podkonta
  const subAccounts = accounts.filter(a => 
    a.number.startsWith(accountNumber + '-') && !a.has_analytics
  );
  if (subAccounts.length === 1) return subAccounts[0].id;
  
  return null;
};
```

### Pliki do modyfikacji
- `src/pages/Documents/CsvImportDialog.tsx`

---

## 3. Nazwy kont na stronie 2 Excel sie urywaja

### Problem
Na stronie 2 raportu Excel kolumna "Tresc" ma `wch: 19` / `wch: 18`, co moze byc za malo dla dlugich nazw kont.

### Rozwiazanie
Dodac funkcje skracajaca nazwy do limitu znakow z kropka na koncu:

```typescript
const truncateName = (name: string, maxLen: number = 22): string => {
  if (name.length <= maxLen) return name;
  return name.substring(0, maxLen - 1) + '.';
};

// Uzycie:
incPrefix ? truncateName(getIncomeAccountName(incPrefix)) : null,
expPrefix ? truncateName(getExpenseAccountName(expPrefix)) : null,
```

### Pliki do modyfikacji
- `src/components/reports/ExportToExcelFull.tsx`

---

## 4. Auto-odswiezenie po dodaniu raportu

### Problem
Po utworzeniu raportu w `ReportsPage.tsx` uzytkownik musi recznie odswiezyc strone.

### Analiza
`handleReportCreated` (linia 31) juz wywoluje `setRefreshKey(prev => prev + 1)`, a `ReportsList` otrzymuje `refreshKey`. Problem moze byc w tym, ze `ReportsList` nie reaguje na zmiane `refreshKey` odpowiednio.

### Rozwiazanie
1. W `ReportsPage.tsx` po `handleReportCreated` dodac invalidacje queries
2. Lub w `ReportsList` dodac `useEffect` reagujacy na `refreshKey` ktory wywola `refetch()`

```typescript
// W ReportsPage.tsx
const queryClient = useQueryClient();

const handleReportCreated = () => {
  setIsCreatingReport(false);
  setViewMode('list');
  queryClient.invalidateQueries({ queryKey: ['reports'] });
  // ...
};
```

### Pliki do modyfikacji
- `src/pages/Reports/ReportsPage.tsx`

---

## 5. Odrzucony raport blokuje usuwanie dokumentow

### Problem
W `DocumentsPage.tsx` linia 198, status `rejected` nie jest w liscie blokujacych:
```typescript
.in('status', ['submitted', 'approved', 'draft'])
```

Uzytkownik chce blokady dla KAZDEGO statusu raportu, dopoki raport istnieje.

### Rozwiazanie
Zmienic zapytanie:

```typescript
// PRZED:
.in('status', ['submitted', 'approved', 'draft'])

// PO - sprawdz czy jakikolwiek raport istnieje:
// Usunac .in() -- kazdy istniejacy raport blokuje
const { data: blockingReport } = await supabase
  .from('reports')
  .select('id, status, month, year')
  .eq('location_id', locationId)
  .eq('month', docDateObj.getMonth() + 1)
  .eq('year', docDateObj.getFullYear())
  .maybeSingle();
```

Dodatkowo zaktualizowac `statusMap` o brakujace statusy (`to_be_corrected`, `rejected`).

### Pliki do modyfikacji
- `src/pages/Documents/DocumentsPage.tsx`

---

## 6. Dodac waluty CAD, NOK, AUD

### Analiza
`CurrencySelector.tsx` juz zawiera wszystkie 6 walut (PLN, EUR, USD, CAD, NOK, AUD) -- to jest OK.

`fetch-nbp-rates/index.ts` linia 9 juz ma:
```typescript
const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD'];
```

Wiec CAD, NOK, AUD sa juz obslugiwane. Trzeba sprawdzic inne miejsca w aplikacji.

### Sprawdzenie
Inne miejsca gdzie waluty moga byc zahardcodowane:
- `DocumentDialog.tsx` - symbole walut (getCurrencySymbol)
- `InlineTransactionRow.tsx` - symbole walut
- `DocumentTable.tsx` - symbole walut
- `DocumentsTable.tsx` - symbole walut
- `ExchangeRateManager.tsx` - lista walut
- `CurrencyAmountInput.tsx` - formatowanie

### Rozwiazanie
Przegladnac wszystkie pliki i upewnic sie ze `getCurrencySymbol` obsluguje CAD, NOK, AUD. Najprawdopodobniej wystarczy dodac je do mapy symboli:

```typescript
const symbols: Record<string, string> = {
  PLN: 'zł',
  EUR: '€',
  USD: '$',
  CAD: 'C$',
  NOK: 'kr',
  AUD: 'A$',
  // ewentualnie inne
};
```

### Pliki do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx` (getCurrencySymbol)
- `src/pages/Documents/InlineTransactionRow.tsx`
- `src/pages/Documents/DocumentTable.tsx`
- `src/pages/Documents/DocumentsTable.tsx`
- `src/components/ExchangeRateManager.tsx`

---

## 7. Podsumowanie walutowe w wyszukiwaniu kont

### Problem
W `AccountSearchPage.tsx` podsumowanie pokazuje tylko PLN. Jesli na koncie sa operacje walutowe, powinno byc dodatkowe podsumowanie w kazdej walucie.

### Rozwiazanie

1. Rozszerzyc zapytanie o transakcje w `AccountSearchPage.tsx` aby pobieralo `currency` i `exchange_rate`
2. W `totals` (useMemo, linia 184) dodac grupowanie po walucie:

```typescript
const currencyTotals = useMemo(() => {
  if (!transactions) return new Map();
  const map = new Map<string, { debit: number; credit: number }>();
  
  transactions.forEach(tx => {
    const currency = tx.currency || tx.document?.currency || 'PLN';
    if (currency === 'PLN') return; // PLN juz jest w glownym podsumowaniu
    
    if (!map.has(currency)) map.set(currency, { debit: 0, credit: 0 });
    const entry = map.get(currency)!;
    
    if (relatedAccountIdsSet.has(tx.debit_account_id)) {
      entry.debit += tx.debit_amount ?? tx.amount ?? 0;
    }
    if (relatedAccountIdsSet.has(tx.credit_account_id)) {
      entry.credit += tx.credit_amount ?? tx.amount ?? 0;
    }
  });
  
  return map;
}, [transactions, relatedAccountIds]);
```

3. Wyswietlic pod glownym podsumowaniem dodatkowe karty dla kazdej waluty:

```typescript
{Array.from(currencyTotals.entries()).map(([currency, data]) => (
  <Card key={currency}>
    <CardContent className="pt-4">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        Podsumowanie w {currency}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>Wn: {data.debit.toFixed(2)} {currency}</div>
        <div>Ma: {data.credit.toFixed(2)} {currency}</div>
        <div>Saldo: {(data.debit - data.credit).toFixed(2)} {currency}</div>
      </div>
    </CardContent>
  </Card>
))}
```

4. Transakcja musi miec pole `currency` -- zapytanie (linia 111) uzywa `*` wiec juz pobiera te dane. Ale interfejs `Transaction` (linia 30) nie ma `currency` ani `exchange_rate` -- trzeba dodac.

### Pliki do modyfikacji
- `src/pages/AccountSearch/AccountSearchPage.tsx` (interfejs Transaction, totals, UI)

---

## Kolejnosc wdrozenia

1. **#0** - has_analytics bug (KRYTYCZNY, natychmiast)
2. **#5** - Blokada usuwania z odrzuconym raportem
3. **#1** - Paginacja dokumentow
4. **#4** - Auto-odswiezenie raportow
5. **#3** - Skracanie nazw w Excel
6. **#6** - Waluty CAD/NOK/AUD
7. **#7** - Podsumowanie walutowe
8. **#2** - Logistyka szablonow CSV
