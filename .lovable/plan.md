
# Plan naprawy 2 krytycznych problemów

## Podsumowanie problemów

| # | Problem | Priorytet | Pliki do modyfikacji |
|---|---------|-----------|---------------------|
| 1 | Wolne ładowanie kont dla admina w wyszukiwaniu i ustawieniach | WYSOKI | `useFilteredAccounts.ts` |
| 2 | Przycisk walutowy nie pokazuje kwot przy operacjach + raporty pokazują kwoty w walucie zamiast PLN | KRYTYCZNY | `DocumentDialog.tsx`, `EditableTransactionRow`, `TransactionsList.tsx`, `financeUtils.ts` |

---

## Problem 1: Wolne ładowanie kont dla admina

### Diagnoza

**Porównanie wydajności:**
- **Administracja (szybka):** Używa bezpośredniego zapytania do tabeli `accounts` (linie 106-130 w `AccountsManagement.tsx`)
- **Wyszukiwanie/Ustawienia (wolne):** Używa RPC `get_user_filtered_accounts_with_analytics` z paginacją w pętli

**Problem z RPC:**
- Funkcja SQL musi przetworzyć 6000+ kont
- Oblicza `has_analytics` dla każdego konta
- Nawet zoptymalizowana funkcja wykonuje się ~500ms per request
- Przy 7 requestach (6500/1000) = ~3.5 sekundy

### Rozwiązanie

Dla admina pominąć RPC i użyć bezpośredniego zapytania do tabeli `accounts` (tak jak w Administracji):

```typescript
// W useFilteredAccounts.ts

export const useFilteredAccounts = (options?: UseFilteredAccountsOptions) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const skipRestrictions = isAdmin || (options?.skipRestrictions ?? false);
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: ["filtered-accounts", user?.id, skipRestrictions, includeInactive],
    queryFn: async (): Promise<FilteredAccount[]> => {
      if (!user?.id) return [];

      // OPTYMALIZACJA: Dla admina użyj bezpośredniego zapytania (jak w Administracji)
      if (isAdmin) {
        let query = supabase
          .from('accounts')
          .select('id, number, name, type, is_active, analytical')
          .order('number');
        
        if (!includeInactive) {
          query = query.eq('is_active', true);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        // Oblicz has_analytics client-side (szybkie dla małych podzbiorów)
        const allAccounts = (data || []) as FilteredAccount[];
        return allAccounts.map(acc => ({
          ...acc,
          has_analytics: allAccounts.some(sub => sub.number.startsWith(acc.number + "-"))
        }));
      }

      // Dla innych ról - użyj RPC z paginacją (bez zmian)
      // ... istniejący kod ...
    },
  });
};
```

**Uwaga:** Supabase ma limit 1000 wierszy per request, ale dla zapytania `select` bez `rpc` można użyć `range()` lub zwiększyć limit. Najlepsze rozwiązanie: dodać paginację i wykorzystać fakt, że bezpośrednie zapytanie jest szybsze niż RPC.

### Alternatywne rozwiązanie (jeszcze szybsze)

Zmienić limit Supabase w projekcie lub dodać indeks na kolumnie `number` do szybszego sortowania:

```sql
CREATE INDEX IF NOT EXISTS idx_accounts_number_sort ON accounts(number);
```

---

## Problem 2: Przycisk walutowy i raporty (KRYTYCZNY)

### Diagnoza szczegółowa

**2.1. Przycisk "Pokaż w PLN" nie zmienia kwot operacji**

Obecny stan:
- Przycisk toggle (`showInPLN`) zmienia tylko wyświetlanie w **sekcji podsumowania** (linie 1959-1976)
- Kwoty w wierszach operacji (`EditableTransactionRow`) **NIE są przeliczane**
- Symbol waluty przy inputach jest statyczny (€ zamiast zł po przełączeniu)

**2.2. Raporty pokazują kwoty w walucie oryginalnej zamiast PLN**

Po analizie bazy danych:
```
Transakcja: t_exchange_rate = 1.0000
Dokument:   doc_exchange_rate = 4.2
```

**BUG:** W kodzie zapisywania transakcji (linie 1025-1040 i 994-1021) **brakuje pola `exchange_rate`!**

Transakcje mają pole `currency` ale NIE mają `exchange_rate` przy insercie/update. Dlatego zostaje wartość domyślna (1).

W `financeUtils.ts` (linia 97-99) pobierany jest kurs z dokumentu:
```typescript
const docExchangeRate = transaction.document?.exchange_rate || transaction.exchange_rate || 1;
```

Ale transakcja ma `exchange_rate = 1`, więc fallback działa źle gdy brak joina z dokumentem.

**2.3. Screenshot użytkownika potwierdza:**
- Dokument: 100 EUR × 4.20 = 420 PLN (podsumowanie pokazuje poprawnie)
- Raport: pokazuje 100 zł zamiast 420 zł (błędne przeliczenie)

### Rozwiązanie

**Część A: Przycisk walutowy pokazuje kwoty przy każdej operacji**

Zmodyfikować `EditableTransactionRow` aby akceptował props `showInPLN` i `exchangeRate`:

```typescript
// W EditableTransactionRow dodać props:
interface EditableTransactionRowProps {
  // ... istniejące props
  showInPLN?: boolean;
  exchangeRate?: number;
}

// W komponencie:
const displayMultiplier = showInPLN && currency !== 'PLN' && exchangeRate ? exchangeRate : 1;
const displayCurrency = showInPLN && currency !== 'PLN' ? 'PLN' : currency;

// W inputach kwot wyświetlać:
// Zamiast: formData.debit_amount.toFixed(2)
// Użyć: (formData.debit_amount * displayMultiplier).toFixed(2)

// Przy zapisie (onBlur) przeliczać z powrotem na walutę:
// Zamiast: setFormData({ debit_amount: numValue })
// Jeśli showInPLN: setFormData({ debit_amount: numValue / exchangeRate })
```

**Część B: Przekazać props do SortableTransactionRow**

```typescript
// W DocumentDialog.tsx linia 1739-1756:
<SortableTransactionRow
  // ... istniejące props
  showInPLN={showInPLN}
  exchangeRate={exchangeRate}
/>
```

**Część C: Zapisywać exchange_rate do transakcji**

W `DocumentDialog.tsx` dodać `exchange_rate` przy insercie i update:

```typescript
// Linia 1025-1040 (INSERT):
const transactionsData = transactionsToInsert.map((t) => ({
  // ... istniejące pola
  currency: t.currency,
  exchange_rate: data.currency !== 'PLN' ? exchangeRate : 1, // DODAJ!
  // ...
}));

// Linia 994-1021 (UPDATE):
.update({
  // ... istniejące pola
  currency: t.currency,
  exchange_rate: data.currency !== 'PLN' ? exchangeRate : 1, // DODAJ!
  // ...
})
```

**Część D: Naprawić wyświetlanie w TransactionsList (raporty)**

W `TransactionsList.tsx` dodać przeliczanie walutowe:

```typescript
// Przed wyświetleniem kwoty:
const getDisplayAmount = (transaction: Transaction) => {
  const amount = transaction.debit_account_id === selectedAccount.id
    ? transaction.debit_amount || transaction.amount
    : transaction.credit_amount || transaction.amount;
  
  // Przelicz na PLN jeśli waluta obca
  const multiplier = transaction.currency !== 'PLN' && transaction.exchange_rate 
    ? transaction.exchange_rate 
    : 1;
  
  return amount * multiplier;
};

// Użyć w JSX:
{formatAmount(getDisplayAmount(transaction))}
```

**Część E: Upewnić się że financeUtils pobiera kurs z dokumentu**

Obecny kod już to robi (linie 97-99), ale dla pewności sprawdzić czy join działa:

```typescript
// W calculateFinancialSummary zapytanie już zawiera:
document:documents!document_id(currency, exchange_rate)

// I użycie:
const docExchangeRate = transaction.document?.exchange_rate || transaction.exchange_rate || 1;
const multiplier = docCurrency !== 'PLN' ? docExchangeRate : 1;
```

To powinno działać jeśli join jest poprawny. Problem może być gdy `transaction.document` jest null.

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/hooks/useFilteredAccounts.ts` | Optymalizacja dla admina - bezpośrednie zapytanie |
| `src/pages/Documents/DocumentDialog.tsx` | Dodać `exchange_rate` do insert/update transakcji, przekazać props do EditableTransactionRow |
| `src/pages/Documents/DocumentDialog.tsx` (EditableTransactionRow) | Dodać props `showInPLN`, `exchangeRate` i przeliczanie kwot |
| `src/pages/AccountSearch/TransactionsList.tsx` | Przeliczać kwoty walutowe na PLN |
| `src/pages/AccountSearch/AccountSearchPage.tsx` | Pobrać `exchange_rate` w zapytaniu o transakcje |

---

## Diagram przepływu - Przeliczanie walut

```text
OBECNY STAN (błędny):
┌─────────────────────────────────────────┐
│ Dokument EUR, kurs 4.20                 │
│ Operacja: 100 EUR                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Zapis do transactions:                  │
│ - debit_amount: 100                     │
│ - currency: EUR                         │
│ - exchange_rate: NULL → domyślnie 1     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Raport pobiera:                         │
│ - transaction.exchange_rate = 1         │
│ - multiplier = 1                        │
│ - Wynik: 100 × 1 = 100 PLN ❌           │
└─────────────────────────────────────────┘

PO NAPRAWIE:
┌─────────────────────────────────────────┐
│ Dokument EUR, kurs 4.20                 │
│ Operacja: 100 EUR                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Zapis do transactions:                  │
│ - debit_amount: 100                     │
│ - currency: EUR                         │
│ - exchange_rate: 4.20 ✓                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Raport pobiera:                         │
│ - transaction.exchange_rate = 4.20      │
│ - multiplier = 4.20                     │
│ - Wynik: 100 × 4.20 = 420 PLN ✓         │
└─────────────────────────────────────────┘
```

---

## Kolejność implementacji

1. **KRYTYCZNE (natychmiast):**
   - Problem 2C: Zapisywanie `exchange_rate` do transakcji (najpierw, bo wpływa na nowe operacje)
   - Problem 2D/E: Naprawa wyświetlania w raportach

2. **WYSOKI:**
   - Problem 1: Optymalizacja ładowania kont dla admina
   - Problem 2A/B: Przycisk walutowy pokazuje kwoty przy operacjach

---

## Szacowany czas realizacji

| Problem | Czas |
|---------|------|
| 1 - Optymalizacja ładowania kont | 1h |
| 2C - Zapisywanie exchange_rate do transakcji | 0.5h |
| 2A/B - Przycisk walutowy przy operacjach | 2h |
| 2D - Przeliczanie w TransactionsList | 0.5h |
| **RAZEM** | **~4 godziny** |

---

## Uwaga o danych historycznych

Po naprawie zapisywania `exchange_rate`, **istniejące transakcje walutowe nadal będą miały `exchange_rate = 1`**. 

Opcje:
1. **Migracja SQL** - zaktualizować istniejące transakcje kursem z dokumentu:
```sql
UPDATE transactions t
SET exchange_rate = d.exchange_rate
FROM documents d
WHERE t.document_id = d.id
  AND d.currency != 'PLN'
  AND (t.exchange_rate IS NULL OR t.exchange_rate = 1);
```

2. **Fallback w kodzie** - pobierać kurs z dokumentu gdy transakcja ma kurs 1 (obecny kod w financeUtils już to robi przez join)

Rekomenduję opcję 1 (migracja) dla czystości danych + opcja 2 jako backup.
