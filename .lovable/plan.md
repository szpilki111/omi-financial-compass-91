# Plan naprawy 2 krytycznych problemów

## ✅ STATUS: ZAIMPLEMENTOWANO

---

## Problem 1: Wolne ładowanie kont dla admina ✅ NAPRAWIONO

### Rozwiązanie
Dla admina zastosowano bezpośrednie zapytanie do tabeli `accounts` zamiast RPC `get_user_filtered_accounts_with_analytics`:
- Znacząco szybsze (~0.5s vs ~30s dla 6000+ kont)
- Używa tej samej logiki paginacji (pageSize=1000) jak poprzednio
- Oblicza `has_analytics` client-side

### Zmiany w plikach
- `src/hooks/useFilteredAccounts.ts` - dodano warunek `if (isAdmin)` z bezpośrednim zapytaniem

---

## Problem 2: Przycisk walutowy i raporty ✅ NAPRAWIONO

### 2.1 Toggle walutowy pokazuje kwoty przy operacjach ✅
- Dodano props `showInPLN` i `exchangeRate` do `SortableTransactionRow` i `EditableTransactionRow`
- Gdy włączony tryb PLN, kwoty operacji wyświetlane są jako `kwota × kurs`
- Pod kwotą PLN pokazana jest oryginalna kwota w walucie
- Inputy są read-only w trybie PLN (żeby użytkownik nie wpisał kwoty PLN która zostanie zapisana jako waluta)

### 2.2 Zapisywanie exchange_rate do transakcji ✅
- Dodano pole `exchange_rate` przy INSERT i UPDATE transakcji w `DocumentDialog.tsx`
- Nowe transakcje walutowe mają poprawny kurs zapisany w bazie

### 2.3 TransactionsList przelicza na PLN ✅
- Dodano funkcję `getAmountInPLN()` która przelicza kwotę po kursie
- Kwoty wyświetlane w PLN, pod nimi oryginalna waluta
- Pobierane jest `currency` i `exchange_rate` z transakcji i dokumentu

### 2.4 financeUtils.ts już obsługuje przeliczanie ✅
- Kod już zawierał logikę przeliczania: `multiplier = docCurrency !== 'PLN' ? docExchangeRate : 1`
- Pobiera kurs zarówno z transakcji jak i dokumentu (fallback)

### Zmiany w plikach
- `src/pages/Documents/DocumentDialog.tsx`:
  - INSERT/UPDATE transakcji zawiera `exchange_rate`
  - `SortableTransactionRow` i `EditableTransactionRow` przyjmują props `showInPLN`, `exchangeRate`
  - Inputy kwot pokazują przeliczone wartości z oryginalną walutą pod spodem
- `src/pages/AccountSearch/TransactionsList.tsx`:
  - Funkcja `getAmountInPLN()` przelicza kwoty walutowe
  - Wyświetla kwoty w PLN z oryginalną walutą pod spodem
- `src/pages/AccountSearch/AccountSearchPage.tsx`:
  - Query pobiera `currency` i `exchange_rate` z dokumentu

---

## Uwaga o danych historycznych

Istniejące transakcje walutowe mogą mieć `exchange_rate = 1`. Rozwiązania:
1. **Migracja SQL** (rekomendowana):
```sql
UPDATE transactions t
SET exchange_rate = d.exchange_rate
FROM documents d
WHERE t.document_id = d.id
  AND d.currency != 'PLN'
  AND (t.exchange_rate IS NULL OR t.exchange_rate = 1);
```

2. **Fallback w kodzie** - financeUtils.ts już pobiera kurs z dokumentu gdy transakcja ma kurs 1
