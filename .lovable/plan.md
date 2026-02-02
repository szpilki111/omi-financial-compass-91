

# Plan naprawy: 4 zidentyfikowane problemy

## Podsumowanie zidentyfikowanych problemów

| # | Problem | Priorytet | Status |
|---|---------|-----------|--------|
| 1 | Brak kont 7xx na raporcie (limit 1000 wierszy Supabase) | KRYTYCZNY | Do naprawy |
| 2 | Widoczność operacji 200-x-x z ekonomatu dla domów | KRYTYCZNY | Do naprawy |
| 3 | Saldo początkowe/końcowe i obroty Wn/Ma na kontach 0xx/1xx/2xx | WYSOKI | Do naprawy |
| 4 | Przycisk odblokowania raportu | ZROBIONY | Już istnieje (weryfikacja) |

---

## Problem 1: Brak kont 7xx na raporcie (KRYTYCZNY)

### Przyczyna
W bazie danych jest:
- **2676 kont 4xx**
- **1292 kont 7xx**
- **Łącznie: 3968 kont**

Zapytanie w `ReportViewFull.tsx` (linia 36-39):
```typescript
.from('accounts')
.select('number, name')
.or('number.like.4%,number.like.7%')
```

Supabase ma **domyślny limit 1000 wierszy**. Konta są sortowane alfabetycznie, więc pierwsze 1000 wyników zawiera tylko konta 4xx. **Wszystkie 22 konta 7xx są obcięte!**

### Rozwiązanie
Zastąpić pojedyncze zapytanie dwoma oddzielnymi zapytaniami z paginacją:

```typescript
const fetchAccountsWithPagination = async (prefix: string) => {
  const allData: { number: string; name: string }[] = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('accounts')
      .select('number, name')
      .like('number', `${prefix}%`)
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    if (data && data.length > 0) {
      allData.push(...data);
      offset += data.length;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

// Pobierz równolegle konta 4xx i 7xx
const [data4xx, data7xx] = await Promise.all([
  fetchAccountsWithPagination('4'),
  fetchAccountsWithPagination('7')
]);
```

### Pliki do modyfikacji
- `src/components/reports/ReportViewFull.tsx` (linie 33-76)
- `src/components/reports/ExportToExcelFull.tsx` (linie 57-82)

---

## Problem 2: Widoczność operacji 200-x-x (KRYTYCZNY)

### Przyczyna
Gdy ekonomat Prowincji (location_identifier: "1") księguje operację na koncie **200-2-8** (rozliczenie z Kodniem), transakcja ma:
- `location_id` = UUID Prowincji
- Konto docelowe = 200-2-8-x

Polityka RLS na `transactions` filtruje po `location_id = get_user_location_id()`, więc użytkownicy z Kodnia (location_identifier: "2-8") **nie widzą tych operacji**.

**Dowód z bazy:**
```
Transakcje na 200-2-8:
- location_id: 799be214... (Prowincja)
- location_identifier: 1
Użytkownicy z Kodnia mają location_identifier: 2-8
```

### Rozwiązanie
Rozszerzyć politykę RLS dla SELECT na tabeli `transactions`, aby użytkownicy mogli widzieć transakcje gdzie:
1. `location_id` = ich lokalizacja (dotychczasowa reguła) **LUB**
2. Numer konta (debit lub credit) zawiera ich location_identifier w segmentach 2-3

```sql
-- Nowa polityka RLS dla transactions (SELECT)
CREATE POLICY "Users can view transactions for their location or matching accounts"
ON public.transactions FOR SELECT
USING (
  CASE
    WHEN get_user_role() IN ('admin', 'prowincjal') THEN true
    ELSE (
      location_id = ANY(get_user_location_ids())
      OR EXISTS (
        SELECT 1 FROM accounts a
        WHERE (a.id = transactions.debit_account_id OR a.id = transactions.credit_account_id)
          AND a.number LIKE '%-%'
          AND EXISTS (
            SELECT 1 FROM locations l
            WHERE l.id = ANY(get_user_location_ids())
              AND l.location_identifier IS NOT NULL
              AND (split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3)) = l.location_identifier
          )
      )
    )
  END
);
```

### Opis działania
Użytkownik z lokalizacji "2-8" (Kodeń) zobaczy:
1. Wszystkie transakcje gdzie `location_id` = ID Kodnia
2. Transakcje z Prowincji gdzie konto debit lub credit ma numer typu `XXX-2-8-Y` (np. 200-2-8-1)

---

## Problem 3: Saldo początkowe/końcowe i obroty Wn/Ma

### Zgłoszenie
> "Na kontach 0xxx, 1xxx, 2xxx powinno być widać: saldo początkowe miesiąca, obroty Wn, obroty Ma, saldo końcowe"

### Obecny stan
`MonthlyTurnoverView.tsx` pokazuje tylko:
- Liczba operacji
- Debet (suma)
- Kredyt (suma)  
- Saldo (debit - credit)

### Rozwiązanie
Rozszerzyć widok o kolumny:

| Miesiąc | Saldo początkowe | Obroty Wn | Obroty Ma | Saldo końcowe |
|---------|------------------|-----------|-----------|---------------|
| Styczeń | 10 000,00 | 5 000,00 | 3 000,00 | 12 000,00 |

**Wzór:** `Saldo końcowe = Saldo początkowe + Obroty Wn - Obroty Ma`

### Pliki do modyfikacji
- `src/pages/AccountSearch/MonthlyTurnoverView.tsx`
- `src/pages/AccountSearch/AccountSearchPage.tsx` (przekazanie salda początkowego)

### Logika obliczania salda początkowego
Dla każdego miesiąca:
1. Pobierz wszystkie transakcje do końca poprzedniego miesiąca
2. Oblicz: `Saldo początkowe = Σ(Wn) - Σ(Ma)` dla wybranego konta

---

## Problem 4: Przycisk odblokowania raportu (ZWERYFIKOWANY)

### Status: JUŻ ZAIMPLEMENTOWANY

Przycisk "Odblokuj raport do edycji" **już istnieje** w `ReportApprovalActions.tsx` (linie 178-281).

### Weryfikacja działania
1. Komponent wyświetla przycisk dla `currentStatus === 'approved'`
2. Funkcja `handleUnlock()` zmienia status na 'draft' i czyści dane recenzenta
3. Odblokowane są również dokumenty z tego okresu

### Potencjalny problem
W `ReportDetails.tsx` (linia 428) warunek:
```tsx
{canApproveReports && (report?.status === 'submitted' || report?.status === 'approved') && (
  <ReportApprovalActions ... />
)}
```

To jest poprawne - komponent jest renderowany dla statusów 'submitted' i 'approved', a wewnątrz komponentu jest logika rozróżniająca co pokazać.

**Ale:** w `ReportApprovalActions.tsx` (linia 198) jest warunek:
```typescript
if (profileError || profile.role !== 'admin') {
  throw new Error('Tylko administrator może odblokować zatwierdzony raport');
}
```

Oznacza to, że **tylko admin może odblokować** (nie prowincjał). To może być zamierzone lub do zmiany.

---

## Diagram przepływu - Naprawa limitu kont

```text
OBECNY STAN (błędny):
┌─────────────────────────────────────────┐
│ SELECT * FROM accounts                  │
│ WHERE number LIKE '4%' OR '7%'          │
│ LIMIT 1000 (domyślny)                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Wynik: 1000 kont (tylko 4xx!)           │
│ Brak kont 7xx                           │
└─────────────────────────────────────────┘

PO NAPRAWIE:
┌─────────────────────────────────────────┐
│ Zapytanie 1: WHERE number LIKE '4%'     │
│ z paginacją → 2676 kont 4xx             │
└─────────────────────────────────────────┘
              +
┌─────────────────────────────────────────┐
│ Zapytanie 2: WHERE number LIKE '7%'     │
│ z paginacją → 1292 kont 7xx             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Wynik: 3968 kont                        │
│ → 22 prefiksy przychodów (7xx)          │
│ → ~30 prefiksów kosztów (4xx)           │
└─────────────────────────────────────────┘
```

---

## Pliki do modyfikacji

| Plik | Zmiana | Priorytet |
|------|--------|-----------|
| `src/components/reports/ReportViewFull.tsx` | Paginacja dla zapytań o konta | KRYTYCZNY |
| `src/components/reports/ExportToExcelFull.tsx` | Paginacja dla eksportu | KRYTYCZNY |
| Migracja SQL | Nowa polityka RLS dla widoczności 200-x-x | KRYTYCZNY |
| `src/pages/AccountSearch/MonthlyTurnoverView.tsx` | Dodać salda początkowe/końcowe | WYSOKI |
| `src/pages/AccountSearch/AccountSearchPage.tsx` | Obliczanie salda początkowego | WYSOKI |

---

## Szacowany czas realizacji

| Etap | Czas |
|------|------|
| Paginacja kont w raporcie i eksporcie | 1h |
| Migracja RLS dla widoczności 200-x-x | 1.5h |
| Rozszerzenie MonthlyTurnoverView | 2h |
| Testy i poprawki | 1h |
| **Razem** | **~5.5 godzin** |

