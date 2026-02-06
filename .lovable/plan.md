# Plan naprawy 3 krytycznych problemów - ZAKOŃCZONY ✅

## Podsumowanie

| # | Problem | Status | Pliki zmodyfikowane |
|---|---------|--------|---------------------|
| 1 | Wolne ładowanie kont (pageSize=20→1000) | ✅ DONE | `src/hooks/useFilteredAccounts.ts` |
| 2 | MT940 format z separatorem `^` | ✅ DONE | `src/pages/Documents/Mt940ImportDialog.tsx` |
| 3 | Przycisk przeliczania waluta/PLN + raporty | ✅ DONE | `DocumentDialog.tsx`, `financeUtils.ts` |

---

## Problem 1: pageSize 20→1000 ✅

**Zmiana:** Linia 52 w `useFilteredAccounts.ts`
```typescript
const pageSize = 1000; // Limit Supabase per request - KRYTYCZNE: nie zmieniać!
```

---

## Problem 2: MT940 parser dla separatora `^` ✅

**Zmiana:** Funkcja `extractDescription()` w `Mt940ImportDialog.tsx`
- Dodano obsługę pola `^00` (typ operacji) jako fallback
- Poprawiono escape separatora `^` w regex
- Złożony opis: najpierw pola 20-25, potem pole 00

---

## Problem 3: Waluta/PLN toggle + raporty ✅

**Zmiany w `DocumentDialog.tsx`:**
- Dodano stan `showInPLN`
- Przycisk toggle do przełączania widoku waluta↔PLN
- Podsumowanie dokumentu pokazuje przeliczone wartości + sekcję PLN dla walut obcych

**Zmiany w `financeUtils.ts`:**
- Dodano join z `documents` do pobierania `currency` i `exchange_rate`
- Przychody/koszty są automatycznie przeliczane na PLN przy użyciu kursu z dokumentu
