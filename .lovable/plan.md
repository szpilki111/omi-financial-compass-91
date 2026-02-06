
# Plan naprawy 3 krytycznych problemów

## Podsumowanie

| # | Problem | Priorytet | Pliki do modyfikacji |
|---|---------|-----------|---------------------|
| 1 | Bardzo wolne ładowanie kont dla admina (pageSize=20 zamiast 1000!) | KRYTYCZNY | `src/hooks/useFilteredAccounts.ts` |
| 2 | MT940 format z separatorem `^` nie wyciąga poprawnie nazw operacji | WYSOKI | `src/pages/Documents/Mt940ImportDialog.tsx` |
| 3 | Przycisk przeliczania waluta/PLN na dokumentach walutowych | WYSOKI | `src/pages/Documents/DocumentDialog.tsx`, `InlineTransactionRow.tsx`, `src/utils/financeUtils.ts` |

---

## Problem 1: Bardzo wolne ładowanie kont dla admina (KRYTYCZNY)

### Przyczyna

W pliku `useFilteredAccounts.ts` linia 52:
```typescript
const pageSize = 20; // ← PROBLEM! Było 1000, ktoś zmienił na 20!
```

**Obliczenia:**
- Liczba aktywnych kont: **6486**
- Przy pageSize = 20: potrzeba **325 zapytań sekwencyjnych**
- Przy pageSize = 1000: potrzeba tylko **7 zapytań**

To oznacza ~46× więcej zapytań HTTP! Każde zapytanie ma overhead sieci (RTT ~50-100ms), więc:
- Przy 20: 325 × 100ms = **32+ sekund** (timeout!)
- Przy 1000: 7 × 100ms = **~0.7 sekundy**

### Rozwiązanie

Przywrócić `pageSize` na 1000 (jak było oryginalnie, zgodnie z limitem Supabase):

```typescript
// Linia 52:
const pageSize = 1000; // Przywrócono poprawną wartość - limit Supabase per request
```

### Dodatkowa optymalizacja

W administracji konta ładują się szybko, bo `AccountsManagement.tsx` (linie 106-130) używa **bezpośredniego zapytania** do tabeli `accounts` z filtrami po stronie serwera:

```typescript
const { data: accounts } = useQuery({
  queryKey: ['accounts', debouncedSearchQuery, showInactive],
  queryFn: async () => {
    let query = supabase
      .from('accounts')
      .select('id, number, name, type, is_active, ...')
      .order('number');
    // ... filtry server-side
    return data;
  },
});
```

**Różnica:**
- **Administracja**: bezpośrednie zapytanie do tabeli → szybkie
- **Wyszukiwanie/Ustawienia**: RPC `get_user_filtered_accounts_with_analytics` + paginacja → wolne

Można rozważyć:
1. Dla admina użyć bezpośredniego zapytania (jak w administracji)
2. Lub poprawić pageSize i zostawić RPC

Proponuję opcję 1 jako rozwiązanie długoterminowe - dla admina pominąć RPC i użyć bezpośredniego zapytania.

---

## Problem 2: MT940 format z separatorem `^` nie wyciąga nazw operacji

### Analiza formatu

**Przykład pliku z `^` (inne banki):**
```
:86:172^00PRZELEW                    ^34000
^3012404416^38PL95124044161111001083941985
^20Przelew środków
^32DOM ZAKONNY MISJONARZY OBLA^33TÓW     ŚWIĘTY KRZYŻ 1
^6226-006    NOWA SŁUPIA      ^63   PL
```

**Problem w kodzie (linia 64-76):**
```typescript
const parts = detailsLine.split(new RegExp(`(?=${separator}[0-9]{2})`));
for (const part of parts) {
  const match = part.match(new RegExp(`^${useTilde ? '~' : '\\^'}(2[0-5])(.*)`, 's'));
  // ...
}
```

**Przyczyna błędu:**
W formacie z `^` podpola często **zlewają się w jednej linii** bez nowej linii między nimi. Np.:
- `^20Przelew środków` - poprawnie wykrywane
- `^32DOM ZAKONNY MISJONARZY OBLA^33TÓW` - wartość pola 32 jest ucięta przez ^33!

Dodatkowo, format z `^` ma **inne kodowanie znaków polskich** (CP852/Mazovia) które może powodować problemy.

### Rozwiązanie

Poprawić funkcję `extractDescription()` aby lepiej obsługiwać format z `^`:

```typescript
const extractDescription = (detailsLine: string): string => {
  let description = 'Operacja bankowa';
  
  const useTilde = detailsLine.includes('~');
  const separator = useTilde ? '~' : '^';
  
  if (!detailsLine || !detailsLine.includes(separator)) {
    return description;
  }

  // Rozdziel na pola - lookahead dla separatora + 2 cyfry
  const parts = detailsLine.split(new RegExp(`(?=${separator.replace('^', '\\^')}[0-9]{2})`));
  let descParts: string[] = [];

  for (const part of parts) {
    // Regex dla pól 20-25 (tytuł operacji) i 00 (typ operacji w formacie ^)
    const escapedSep = separator === '^' ? '\\^' : separator;
    const match = part.match(new RegExp(`^${escapedSep}(2[0-5]|00)(.*)`, 's'));
    
    if (match) {
      const fieldNum = match[1];
      let content = match[2].trim();
      
      // Usuń końcowe spacje i znaki ASCII 255 (puste pola PKO)
      content = content.replace(/\s+$/, '').replace(/[\u00FF]+/g, '');
      
      // Ignoruj puste lub zbyt krótkie wartości
      if (!content || content.length < 2 || content.charCodeAt(0) === 255) continue;
      
      // Pole 00 często zawiera typ przelewu (np. "PRZELEW INTERNET M/B")
      if (fieldNum === '00') {
        // Wyciągnij opis z pola 00 przed pierwszym separatorem lub spacją
        const cleanedContent = content.split(/\s{2,}/)[0].trim();
        if (cleanedContent.length > 5 && !cleanedContent.match(/^\d+$/)) {
          descParts.unshift(cleanedContent); // Na początek
        }
      } else if (fieldNum >= '20' && fieldNum <= '25') {
        descParts.push(content);
      }
    }
  }

  if (descParts.length > 0) {
    description = descParts.join(' ').replace(/\s+/g, ' ').trim();
    // Ogranicz długość opisu
    if (description.length > 200) {
      description = description.substring(0, 197) + '...';
    }
  }

  return description;
};
```

### Dodatkowe usprawnienie - pole `^00`

W formacie z `^` pole `^00` zawiera typ operacji (np. "PRZELEW INTERNET M/B"). To może być użyteczne jako część opisu, gdy pola 20-25 są puste lub zawierają tylko krótki tekst.

---

## Problem 3: Przycisk przeliczania waluta/PLN na dokumentach walutowych

### Opis wymagania

1. Na dokumentach walutowych (currency != 'PLN') dodać przycisk toggle
2. Po przełączeniu na PLN → kwoty operacji wyświetlane jako `kwota × kurs`
3. Po przełączeniu na walutę → kwoty oryginalne + info o kursie
4. Podsumowanie dokumentu zawsze w PLN
5. Raporty mają automatycznie pobierać wartości w PLN (przeliczone po kursie dokumentu)

### Rozwiązanie

**1. Dodać stan w `DocumentDialog.tsx`:**
```typescript
const [showInPLN, setShowInPLN] = useState(false);
const watchedCurrency = form.watch('currency');
const isForeignCurrency = watchedCurrency && watchedCurrency !== 'PLN';
```

**2. Dodać przycisk toggle nad tabelą operacji:**
```tsx
{isForeignCurrency && (
  <div className="flex items-center gap-2 mb-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowInPLN(!showInPLN)}
      className="flex items-center gap-2"
    >
      <RefreshCw className="h-4 w-4" />
      {showInPLN ? `Pokaż w ${watchedCurrency}` : 'Pokaż w PLN'}
    </Button>
    {showInPLN && (
      <span className="text-sm text-muted-foreground">
        Kurs: {exchangeRate.toFixed(4)} PLN/{watchedCurrency}
      </span>
    )}
  </div>
)}
```

**3. Przekazać props do wyświetlania transakcji:**
Zaktualizować miejsca gdzie wyświetlane są kwoty operacji, aby przeliczać:
```typescript
const displayAmount = showInPLN && exchangeRate 
  ? amount * exchangeRate 
  : amount;
```

**4. Podsumowanie dokumentu zawsze w PLN:**
```typescript
const totalInPLN = transactions.reduce((sum, t) => {
  const amount = Math.max(t.debit_amount || 0, t.credit_amount || 0);
  return sum + (amount * exchangeRate);
}, 0);

// Na dole tabeli operacji:
<div className="mt-4 p-3 bg-gray-100 rounded-lg">
  <span className="font-semibold">Suma w PLN: </span>
  <span className="text-lg font-bold">{formatNumber(totalInPLN)} zł</span>
  {isForeignCurrency && (
    <span className="text-sm text-muted-foreground ml-2">
      (kurs: {exchangeRate.toFixed(4)})
    </span>
  )}
</div>
```

**5. Raporty - przeliczanie walut:**
W `financeUtils.ts` zmodyfikować logikę pobierania transakcji, aby uwzględniała kurs z dokumentu:

```typescript
// Dodać join z documents dla exchange_rate
const query = supabase
  .from('transactions')
  .select(`
    *,
    document:documents!document_id(currency, exchange_rate),
    debit_account:accounts!debit_account_id(number, name),
    credit_account:accounts!credit_account_id(number, name)
  `);

// Przy obliczaniu sum:
transactions.forEach((transaction: any) => {
  const docCurrency = transaction.document?.currency || 'PLN';
  const docExchangeRate = transaction.document?.exchange_rate || 1;
  
  // Przelicz na PLN jeśli waluta obca
  const multiplier = docCurrency !== 'PLN' ? docExchangeRate : 1;
  
  if (baseCredit && baseCredit.startsWith('7')) {
    const amount = (transaction.credit_amount ?? transaction.amount ?? 0) * multiplier;
    income += amount;
  }
  
  if (baseDebit && baseDebit.startsWith('4')) {
    const amount = (transaction.debit_amount ?? transaction.amount ?? 0) * multiplier;
    expense += amount;
  }
});
```

---

## Kolejność implementacji

1. **KRYTYCZNY (natychmiast):**
   - Problem 1: Zmiana `pageSize` z 20 na 1000 (1 linia kodu!)

2. **WYSOKI (szybko):**
   - Problem 2: Naprawa parsera MT940 dla formatu z `^`
   - Problem 3: Toggle waluta/PLN (wymaga więcej zmian)

---

## Szacowany czas realizacji

| Problem | Czas |
|---------|------|
| 1 - pageSize (1 linia!) | 5 min |
| 2 - Parser MT940 | 1.5h |
| 3 - Toggle waluta/PLN + integracja z raportami | 3h |
| **RAZEM** | **~5 godzin** |

---

## Pliki do modyfikacji

| Problem | Plik |
|---------|------|
| 1 | `src/hooks/useFilteredAccounts.ts` - linia 52 |
| 2 | `src/pages/Documents/Mt940ImportDialog.tsx` - funkcja `extractDescription()` |
| 3 | `src/pages/Documents/DocumentDialog.tsx` - stan `showInPLN`, przycisk toggle |
| 3 | `src/pages/Documents/InlineTransactionRow.tsx` - opcjonalnie wyświetlanie PLN |
| 3 | `src/utils/financeUtils.ts` - join z documents, przeliczanie walut |
