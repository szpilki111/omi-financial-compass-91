

## Plan: Saldo początkowe w pasku walutowym

### Problem
Karta walutowa (np. EUR) w wyszukiwarce kont pokazuje "— EUR" jako saldo początkowe, bo:
1. **Brak kalkulacji walutowego salda otwarcia** — query `openingBalanceForYear` nie pobiera informacji o walucie/kursie, więc nie da się wyliczyć salda w walucie obcej.
2. **Saldo PLN też potencjalnie niedokładne** — opening balance nie mnoży przez `exchange_rate`, podczas gdy obroty bieżącego roku to robią (linia 208: `amount * exchangeRate`).

### Rozwiązanie

**Plik: `src/pages/AccountSearch/AccountSearchPage.tsx`**

#### 1. Rozszerzyć query salda otwarcia (linie 145-149)
Dodać do `.select()` pola `currency, exchange_rate` oraz join na dokument:
```
.select('debit_account_id, credit_account_id, debit_amount, credit_amount, amount, currency, exchange_rate, document:documents(currency, exchange_rate)')
```

#### 2. Zmienić typ zwracany z `number` na obiekt
Zamiast zwracać sam `number`, zwrócić:
```typescript
{ plnBalance: number, currencyBalances: Map<string, number> }
```

Logika w `queryFn`:
- Dla każdej transakcji historycznej określić walutę (dokument > transakcja > PLN)
- **PLN opening balance**: `amount * exchangeRate` (tak samo jak obroty bieżące)
- **Currency opening balances**: `debit_amount / credit_amount` bez przeliczania (tak samo jak `currencyTotals`)

#### 3. Zaktualizować `totals` useMemo (linia 216)
```typescript
const openingBalance = openingBalanceData.plnBalance; // zamiast openingBalanceForYear
```

#### 4. Zaktualizować rendering kart walutowych (linie 660-691)
Zamiast `— {currency}`, wyświetlić:
```typescript
const currencyOpeningBalance = openingBalanceData.currencyBalances.get(currency) || 0;
// Saldo początkowe: currencyOpeningBalance
// Saldo końcowe: currencyOpeningBalance + data.debit - data.credit
```

### Pliki do zmiany
| Plik | Zmiana |
|------|--------|
| `src/pages/AccountSearch/AccountSearchPage.tsx` | Rozszerzyć query opening balance o walutę/kurs, wyliczyć saldo per waluta, wyświetlić w kartach walutowych |

