

# Plan naprawy: Wszystkie prefiksy kont na raporcie

## Podsumowanie problemu

Raporty nie wyświetlają wszystkich kont 4xx i 7xx z bazy danych, ponieważ:
1. Zapytanie w `ReportViewFull.tsx` (linie 36-39) pobiera konta bezpośrednio z tabeli `accounts`
2. Polityki RLS na tabeli `accounts` filtrują wyniki tylko do kont z lokalizacji użytkownika
3. Użytkownik z lokalizacji "2-1" widzi np. tylko konta `701-2-1`, `402-2-1`, ale nie widzi kont innych lokalizacji

**Stan aktualny:**
- W bazie istnieje 22 unikalnych prefiksów 7xx i 46 prefiksów 4xx
- Użytkownik widzi tylko część z nich (filtrowane przez RLS)

**Wymaganie:** 
Raport ma wyświetlać WSZYSTKIE prefiksy kont (4xx i 7xx) z bazy, nawet jeśli:
- Stan konta jest zerowy
- Konto należy do innej lokalizacji

---

## Rozwiązanie

Zamiast bezpośredniego zapytania do tabeli `accounts`, użyć istniejącej funkcji RPC `get_user_filtered_accounts_with_analytics` z parametrem `p_skip_restrictions: true`. Ta funkcja jest `SECURITY DEFINER` i omija RLS.

---

## Zmiany w kodzie

### 1. Modyfikacja `ReportViewFull.tsx`

**Zmiana zapytania o prefiksy kont (linie 33-76):**

```typescript
// BYŁO (nie działa - RLS filtruje):
const { data: accountPrefixes } = useQuery({
  queryKey: ['account-prefixes-for-report', locationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('number, name')
      .or('number.like.4%,number.like.7%');
    // ...
  }
});

// MA BYĆ (używa RPC z skip_restrictions=true):
const { data: accountPrefixes } = useQuery({
  queryKey: ['account-prefixes-for-report-all'],  // Bez locationId - to samo dla wszystkich
  queryFn: async () => {
    // Użyj funkcji RPC z p_skip_restrictions=true aby pobrać WSZYSTKIE konta
    const { data, error } = await supabase.rpc('get_user_filtered_accounts_with_analytics', {
      p_user_id: user?.id,
      p_include_inactive: false,
      p_skip_restrictions: true  // KLUCZ: pomija filtrowanie lokalizacji
    });
    
    if (error) throw error;
    
    // Filtruj tylko konta 4xx i 7xx i buduj mapy prefiksów
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
    
    // Sortuj numerycznie
    const sortedIncome = Array.from(incomePrefixes).sort((a, b) => parseInt(a) - parseInt(b));
    const sortedExpense = Array.from(expensePrefixes).sort((a, b) => parseInt(a) - parseInt(b));
    
    return {
      incomePrefixes: sortedIncome,
      expensePrefixes: sortedExpense,
      incomeNames,
      expenseNames
    };
  },
  enabled: !!user?.id
});
```

### 2. Analogiczna zmiana w `ExportToExcelFull.tsx`

Zmienić pobieranie kont w funkcji `handleExport` aby również używać RPC z `p_skip_restrictions: true`.

---

## Diagram przepływu danych

```text
PRZED (błędne):
┌─────────────────────────────────────────────────────────┐
│ Zapytanie: SELECT * FROM accounts WHERE number LIKE... │
│                            ↓                            │
│               RLS FILTRUJE po lokalizacji               │
│                            ↓                            │
│        Użytkownik 2-1 widzi tylko konta *-2-1           │
│                            ↓                            │
│           Raport pokazuje niepełną listę kont           │
└─────────────────────────────────────────────────────────┘

PO (poprawne):
┌─────────────────────────────────────────────────────────┐
│ Zapytanie: RPC get_user_filtered_accounts_with_analytics│
│            z p_skip_restrictions = true                 │
│                            ↓                            │
│         Funkcja SECURITY DEFINER omija RLS              │
│                            ↓                            │
│          Zwraca WSZYSTKIE konta z bazy                  │
│                            ↓                            │
│        Raport pokazuje 22 prefiksy 7xx + 46 prefiksy 4xx│
└─────────────────────────────────────────────────────────┘
```

---

## Oczekiwany rezultat

Po implementacji raport będzie wyświetlać:
- **22 prefiksy przychodów (7xx):** 701-730 (te które istnieją w bazie)
- **46 prefiksów kosztów (4xx):** 401-463 (te które istnieją w bazie)
- Każde konto będzie miało poprawną nazwę z bazy
- Konta z zerowym stanem też będą widoczne (kwota 0,00)

---

## Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `src/components/reports/ReportViewFull.tsx` | Zmiana zapytania na RPC z `p_skip_restrictions: true` |
| `src/components/reports/ExportToExcelFull.tsx` | Ta sama zmiana dla eksportu Excel |

---

## Uwagi bezpieczeństwa

Używanie `p_skip_restrictions: true` w kontekście raportów jest bezpieczne, ponieważ:
1. Pobieramy tylko metadane kont (numer, nazwa) - nie dane finansowe
2. Dane transakcji nadal są filtrowane przez lokalizację
3. Raport pokazuje kwoty tylko z transakcji lokalizacji użytkownika
4. To jest wymaganie biznesowe - plan kont jest wspólny dla całej organizacji

