

# Plan naprawy 7 zgłoszonych problemów (zaktualizowany)

## Podsumowanie problemów

| # | Problem | Priorytet | Pliki do modyfikacji |
|---|---------|-----------|---------------------|
| 1 | Ostatni dzień miesiąca kwalifikowany na następny miesiąc (strefa czasowa) | KRYTYCZNY | Wiele plików z `toISOString()` |
| 2 | Przycisk przeliczania waluta/PLN na dokumencie walutowym + integracja z raportami | WYSOKI | `DocumentDialog.tsx`, `InlineTransactionRow.tsx` |
| 3 | Data powiadomień email ustawiona na 11. każdego miesiąca | NISKI | `send-report-reminders/index.ts` |
| 4 | Unikalny numer dokumentu w bazie danych | WYSOKI | Migracja SQL |
| 5 | Admin nie widzi żadnych kont - TIMEOUT SQL (~40M operacji) | KRYTYCZNY | Migracja SQL - zoptymalizowana funkcja |
| 6 | Usunąć przycisk "Excel (skrócony)" z raportu | NISKI | `ReportDetails.tsx` |
| 7 | Dwa przyciski importu MT940: PKO BP vs reszta banków | ŚREDNI | `Mt940ImportDialog.tsx`, `DocumentDialog.tsx` |

---

## Problem 1: Ostatni dzień miesiąca jest przesuwany (KRYTYCZNY)

### Przyczyna główna
Kod używa `new Date(year, month, 0).toISOString().split('T')[0]` do obliczenia ostatniego dnia miesiąca.

**Problem:** `toISOString()` konwertuje lokalną datę na UTC. Dla stref czasowych CET/CEST (Polska), godzina 00:00:00 lokalna to 23:00:00 UTC poprzedniego dnia.

**Przykład:**
```javascript
// Dla strefy CET (+1)
const date = new Date(2025, 11, 31); // 31 grudnia 2025, 00:00:00 CET
date.toISOString();                   // "2025-12-30T23:00:00.000Z" ← PRZESUNIĘCIE!
date.toISOString().split('T')[0];     // "2025-12-30" ← ZŁY DZIEŃ!
```

### Rozwiązanie
Stworzyć centralną funkcję do bezpiecznego formatowania dat:

```typescript
// src/utils/dateUtils.ts
export const formatDateForDB = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLastDayOfMonth = (year: number, month: number): string => {
  // month is 1-12 (January=1, December=12)
  const lastDay = new Date(year, month, 0); // 0 = ostatni dzień poprzedniego miesiąca
  return formatDateForDB(lastDay);
};

export const getFirstDayOfMonth = (year: number, month: number): string => {
  const firstDay = new Date(year, month - 1, 1);
  return formatDateForDB(firstDay);
};
```

### Pliki do modyfikacji
Zastąpić wszystkie wystąpienia `toISOString().split('T')[0]` nową funkcją:
- `src/pages/Reports/ReportDetails.tsx`
- `src/pages/Reports/ReportForm.tsx`
- `src/components/reports/ReportViewFull.tsx`
- `src/components/reports/ExportToExcel.tsx`
- `src/components/reports/ExportToExcelFull.tsx`
- `src/components/reports/YearToDateCashFlowBreakdown.tsx`
- `src/components/reports/ReportAccountsBreakdown.tsx`
- `src/components/reports/ReportApprovalActions.tsx`
- `src/utils/financeUtils.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/Documents/CsvImportDialog.tsx`
- `src/pages/Documents/Mt940ImportDialog.tsx`
- I inne pliki wykryte w wyszukiwaniu

---

## Problem 2: Przycisk przeliczania waluta/PLN na dokumentach walutowych

### Opis wymagania
1. Na dokumentach walutowych (gdzie waluta != PLN) dodać przycisk toggle do przełączania widoku między walutą a PLN
2. Wyświetlać kwoty operacji albo w walucie oryginalnej albo przeliczone na PLN (kwota × kurs)
3. Na końcu dokumentu pokazywać podsumowanie zawsze w PLN
4. Raporty mają automatycznie pobierać wartości przeliczone na PLN

### Rozwiązanie

**1. Dodać stan `showInPLN` do `DocumentDialog.tsx`:**
```typescript
const [showInPLN, setShowInPLN] = useState(false);
const watchedCurrency = form.watch('currency');
const isForeignCurrency = watchedCurrency && watchedCurrency !== 'PLN';
```

**2. Dodać przycisk toggle w nagłówku tabeli operacji:**
```tsx
{isForeignCurrency && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowInPLN(!showInPLN)}
  >
    {showInPLN ? `Pokaż w ${watchedCurrency}` : 'Pokaż w PLN'}
  </Button>
)}
```

**3. Przekazać props do `InlineTransactionRow`:**
```tsx
<InlineTransactionRow
  showInPLN={showInPLN}
  exchangeRate={exchangeRate}
  // ...existing props
/>
```

**4. W `InlineTransactionRow.tsx` przeliczać kwoty:**
```typescript
const displayAmount = showInPLN 
  ? (amount * exchangeRate).toFixed(2) 
  : amount.toFixed(2);
```

**5. Podsumowanie dokumentu zawsze w PLN:**
```typescript
// Na dole tabeli
const totalPLN = transactions.reduce((sum, t) => {
  const amount = Math.max(t.debit_amount || 0, t.credit_amount || 0);
  return sum + (amount * exchangeRate);
}, 0);
```

**6. Raporty - już używają PLN:**
W `financeUtils.ts` i `ReportViewFull.tsx` kwoty są pobierane bezpośrednio z bazy, więc jeśli chcemy automatyczne przeliczanie, musimy zmodyfikować zapytania aby mnożyły przez kurs dokumentu. To wymaga dodania joina z documents.

### Pliki do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx` - dodać przycisk toggle i stan
- `src/pages/Documents/InlineTransactionRow.tsx` - wyświetlanie przeliczonych kwot
- `src/utils/financeUtils.ts` - przeliczanie walutowe w obliczeniach raportu

---

## Problem 3: Data powiadomień email na 11. każdego miesiąca

### Przyczyna
W pliku `send-report-reminders/index.ts` (linia 86):
```typescript
const deadlineDay = 10;
```

### Rozwiązanie
Zmienić wartość na 11:
```typescript
const deadlineDay = 11;
```

### Plik do modyfikacji
- `supabase/functions/send-report-reminders/index.ts`

---

## Problem 4: Unikalny numer dokumentu w bazie danych

### Przyczyna
Brak ograniczenia UNIQUE na kolumnie `document_number` w tabeli `documents`.

### Rozwiązanie
Utworzyć migrację SQL z:
1. Funkcją do normalizacji numeru dokumentu (usunięcie białych znaków)
2. Unikalnym indeksem na znormalizowanym numerze

```sql
-- Unikany indeks na znormalizowanym numerze per lokalizacja
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_number 
ON documents (TRIM(BOTH FROM document_number), location_id);
```

### Uwagi
- Indeks jest per location_id, bo różne lokalizacje mogą mieć ten sam format numeru
- Przed utworzeniem indeksu trzeba sprawdzić czy nie ma już duplikatów

### Plik do modyfikacji
- Nowa migracja SQL

---

## Problem 5: Admin nie widzi żadnych kont - TIMEOUT SQL (KRYTYCZNY - ZAKTUALIZOWANY)

### Zdiagnozowany problem

Po analizie logów i testach SQL:

**Błąd:** `canceling statement due to statement timeout` (kod 57014)

**Przyczyna główna:** Funkcja `get_user_filtered_accounts_with_analytics` wykonuje dla admina korelowane podzapytanie EXISTS dla KAŻDEGO z **6475 kont**:

```sql
EXISTS(SELECT 1 FROM accounts sub WHERE sub.number LIKE (a.number || '-%') AND sub.is_active = true) as has_analytics
```

**Statystyki z EXPLAIN ANALYZE:**
- Nested Loop Semi Join z **~40 milionów porównań** (39,870,698)
- Czas wykonania: **8271 ms** (8+ sekund)
- Domyślny timeout Supabase: 8 sekund
- Rezultat: timeout i błąd 500

### Rozwiązanie - zoptymalizowana funkcja SQL

Zamiast korelowanego podzapytania (N×N operacji), użyjemy **pojedynczego przejścia z materializacją** poprzez CTE:

```sql
CREATE OR REPLACE FUNCTION public.get_user_filtered_accounts_with_analytics(
  p_user_id uuid, 
  p_include_inactive boolean DEFAULT false, 
  p_skip_restrictions boolean DEFAULT false
)
RETURNS TABLE(id uuid, number text, name text, type text, is_active boolean, analytical boolean, has_analytics boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role text;
  v_location_ids uuid[];
  v_location_identifiers text[];
  v_category_prefixes text[];
  v_restricted_prefixes text[];
BEGIN
  -- Pobierz rolę użytkownika
  SELECT p.role INTO v_user_role
  FROM profiles p
  WHERE p.id = p_user_id;

  -- Dla adminów i prowincjałów zwróć wszystkie konta - ZOPTYMALIZOWANE
  IF v_user_role IN ('admin', 'prowincjal') OR p_skip_restrictions THEN
    RETURN QUERY
    WITH 
    -- Krok 1: Pobierz wszystkie aktywne konta
    base_accounts AS (
      SELECT a.id, a.number, a.name, a.type, a.is_active, a.analytical
      FROM accounts a
      WHERE (p_include_inactive OR a.is_active = true)
    ),
    -- Krok 2: Znajdź wszystkie numery kont które są RODZICAMI (mają podkonta)
    -- Używamy split na myślnikach i budujemy zbiór prefiksów
    parent_numbers AS (
      SELECT DISTINCT 
        -- Dla konta 100-2-3-1 rodzice to: 100-2-3, 100-2, 100
        -- Wyciągamy wszystkie możliwe prefiksy
        regexp_replace(ba.number, '-[^-]+$', '') as parent_prefix
      FROM base_accounts ba
      WHERE ba.number LIKE '%-%'  -- Ma co najmniej jeden myślnik = może mieć rodzica
    )
    SELECT 
      ba.id,
      ba.number,
      ba.name,
      ba.type,
      ba.is_active,
      ba.analytical,
      -- Konto ma has_analytics jeśli jego numer jest w zbiorze parent_numbers
      EXISTS(SELECT 1 FROM parent_numbers pn WHERE pn.parent_prefix = ba.number) as has_analytics
    FROM base_accounts ba
    ORDER BY ba.number;
    RETURN;
  END IF;

  -- Dla pozostałych ról - standardowa logika z ograniczeniami lokalizacji
  -- [reszta kodu bez zmian - dla ekonomów/proboszczów działa poprawnie]
  
  -- Pobierz lokalizacje użytkownika z user_locations
  SELECT ARRAY_AGG(ul.location_id) INTO v_location_ids
  FROM user_locations ul
  WHERE ul.user_id = p_user_id;

  -- Fallback do profiles.location_id
  IF v_location_ids IS NULL OR array_length(v_location_ids, 1) IS NULL THEN
    SELECT ARRAY[p.location_id] INTO v_location_ids
    FROM profiles p
    WHERE p.id = p_user_id AND p.location_id IS NOT NULL;
  END IF;

  -- Brak lokalizacji = brak kont
  IF v_location_ids IS NULL OR array_length(v_location_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Pobierz identyfikatory lokalizacji (np. '5-3')
  SELECT ARRAY_AGG(DISTINCT l.location_identifier) INTO v_location_identifiers
  FROM locations l
  WHERE l.id = ANY(v_location_ids) AND l.location_identifier IS NOT NULL;

  IF v_location_identifiers IS NULL OR array_length(v_location_identifiers, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Pobierz kategorie lokalizacji (pierwsza cyfra location_identifier)
  SELECT ARRAY_AGG(DISTINCT LEFT(li, 1)) INTO v_category_prefixes
  FROM unnest(v_location_identifiers) AS li
  WHERE LEFT(li, 1) != '';

  -- Pobierz ograniczone prefiksy kont dla kategorii użytkownika
  IF v_category_prefixes IS NOT NULL AND array_length(v_category_prefixes, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT acr.account_number_prefix) INTO v_restricted_prefixes
    FROM account_category_restrictions acr
    WHERE acr.category_prefix = ANY(v_category_prefixes)
      AND acr.is_restricted = true;
  END IF;

  IF v_restricted_prefixes IS NULL THEN
    v_restricted_prefixes := ARRAY[]::text[];
  END IF;

  -- Zwróć konta dla użytkownika z lokalizacją
  RETURN QUERY
  WITH 
  location_matched_accounts AS (
    SELECT a.id
    FROM accounts a
    CROSS JOIN UNNEST(v_location_identifiers) AS loc_id
    WHERE (p_include_inactive OR a.is_active = true)
      AND a.number LIKE '%-%'
      AND split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) = loc_id
      AND NOT (split_part(a.number, '-', 1) = ANY(v_restricted_prefixes))
    
    UNION
    
    SELECT la.account_id
    FROM location_accounts la
    INNER JOIN accounts acc ON acc.id = la.account_id
    WHERE la.location_id = ANY(v_location_ids)
      AND NOT (split_part(acc.number, '-', 1) = ANY(v_restricted_prefixes))
  ),
  base_accounts AS (
    SELECT DISTINCT a.id, a.number, a.name, a.type, a.is_active, a.analytical
    FROM accounts a
    INNER JOIN location_matched_accounts lma ON a.id = lma.id
  ),
  parent_numbers AS (
    SELECT DISTINCT regexp_replace(ba.number, '-[^-]+$', '') as parent_prefix
    FROM base_accounts ba
    WHERE ba.number LIKE '%-%'
  )
  SELECT 
    ba.id,
    ba.number,
    ba.name,
    ba.type,
    ba.is_active,
    ba.analytical,
    EXISTS(SELECT 1 FROM parent_numbers pn WHERE pn.parent_prefix = ba.number) as has_analytics
  FROM base_accounts ba
  ORDER BY ba.number;
END;
$function$;
```

### Dlaczego to rozwiązanie jest szybsze

**Przed (stary algorytm):**
```text
┌─────────────────────────────────────────┐
│ Dla KAŻDEGO z 6475 kont:                │
│   → Przeskanuj WSZYSTKIE 6475 kont      │
│   → Sprawdź LIKE (number || '-%')       │
│ = 6475 × 6475 = ~42 miliony operacji    │
│ Czas: 8+ sekund → TIMEOUT               │
└─────────────────────────────────────────┘
```

**Po (nowy algorytm):**
```text
┌─────────────────────────────────────────┐
│ Krok 1: Pobierz 6475 kont (1 skan)      │
│ Krok 2: Wyciągnij prefiksy rodziców     │
│         (regexp_replace na 6475 kont)   │
│ Krok 3: JOIN na zbiorze prefiksów       │
│         (set lookup - O(1) per konto)   │
│ = 6475 + 6475 + 6475 = ~20k operacji    │
│ Czas: <500ms                            │
└─────────────────────────────────────────┘
```

### Pliki do modyfikacji
- Nowa migracja SQL z poprawioną funkcją `get_user_filtered_accounts_with_analytics`

---

## Problem 6: Usunąć przycisk "Excel (skrócony)"

### Lokalizacja
W pliku `src/pages/Reports/ReportDetails.tsx` (linie 362-370):
```tsx
<ExportToExcel
  reportId={reportId!}
  reportTitle={report.title}
  locationName={report.location?.name || 'Nieznana'}
  period={report.period}
  year={report.year}
  month={report.month}
  locationId={report.location_id}
/>
```

### Rozwiązanie
Usunąć komponent `ExportToExcel` z `ReportDetails.tsx`, pozostawiając tylko `ExportToExcelFull`.

### Pliki do modyfikacji
- `src/pages/Reports/ReportDetails.tsx` - usunąć import i użycie ExportToExcel

---

## Problem 7: Dwa przyciski importu MT940

### Opis
Obecny parser MT940 obsługuje oba formaty (separator `^` i `~`), ale użytkownik chce osobne przyciski dla jasności.

### Rozwiązanie

**1. W `DocumentDialog.tsx` zastąpić jeden przycisk MT940 dwoma:**
```tsx
<Button onClick={() => setMt940Dialog({ open: true, variant: 'pko' })}>
  <Upload className="mr-2 h-4 w-4" />
  Import MT940 PKO BP
</Button>
<Button onClick={() => setMt940Dialog({ open: true, variant: 'other' })}>
  <Upload className="mr-2 h-4 w-4" />
  Import MT940 (inne banki)
</Button>
```

**2. Przekazać wariant do `Mt940ImportDialog`:**
```tsx
<Mt940ImportDialog
  open={mt940Dialog.open}
  variant={mt940Dialog.variant} // 'pko' | 'other'
  onClose={() => setMt940Dialog({ open: false, variant: 'other' })}
  onImportComplete={handleMt940Complete}
/>
```

**3. W `Mt940ImportDialog.tsx` dodać informację o formacie:**
```tsx
interface Mt940ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
  variant?: 'pko' | 'other'; // Nowy prop
}

// W komponencie
<DialogTitle>
  Import wyciągu MT940 {variant === 'pko' ? '(PKO BP)' : '(inne banki)'}
</DialogTitle>

{variant === 'pko' ? (
  <p className="text-sm text-muted-foreground">
    Format PKO BP z podpolami ~20-~63
  </p>
) : (
  <p className="text-sm text-muted-foreground">
    Standardowy format SWIFT z polami ^20-^63
  </p>
)}
```

Parser już obsługuje oba formaty automatycznie, więc nie trzeba zmieniać logiki parsowania - tylko UI.

### Pliki do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx` - dwa przyciski
- `src/pages/Documents/Mt940ImportDialog.tsx` - nowy prop `variant`

---

## Kolejność implementacji

1. **KRYTYCZNE (natychmiast):**
   - Problem 5: Zoptymalizowana funkcja SQL dla admina (timeout)
   - Problem 1: Naprawa stref czasowych (wpływa na całą aplikację)

2. **WYSOKIE (szybko):**
   - Problem 4: Unikalne numery dokumentów (migracja SQL)
   - Problem 2: Waluta/PLN toggle

3. **ŚREDNIE:**
   - Problem 7: Dwa przyciski MT940

4. **NISKIE:**
   - Problem 3: Termin powiadomień (11. dzień)
   - Problem 6: Usunięcie Excel skrócony

---

## Szacowany czas realizacji

| Problem | Czas |
|---------|------|
| 5 - Zoptymalizowana funkcja SQL | 1h |
| 1 - Strefy czasowe (nowy moduł + refactor wielu plików) | 3h |
| 2 - Toggle waluta/PLN | 2h |
| 3 - Data powiadomień | 0.25h |
| 4 - Unikalne numery dokumentów | 0.5h |
| 6 - Usunięcie Excel skrócony | 0.25h |
| 7 - Dwa przyciski MT940 | 1h |
| **RAZEM** | **~8 godzin** |

---

## Diagram - Optymalizacja problemu 5 (admin timeout)

```text
PRZED (stary algorytm - TIMEOUT):
┌─────────────────────────────────────────┐
│ SELECT ... FROM accounts a              │
│ WHERE EXISTS(                           │
│   SELECT 1 FROM accounts sub            │
│   WHERE sub.number LIKE (a.number||'-%')│
│ )                                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ EXPLAIN ANALYZE:                        │
│ Nested Loop Semi Join                   │
│ - 6475 × 6475 = 41,925,625 porównań     │
│ - Rows removed by join filter: 39.8M    │
│ - Execution Time: 8271 ms → TIMEOUT     │
└─────────────────────────────────────────┘

PO (nowy algorytm - SZYBKI):
┌─────────────────────────────────────────┐
│ WITH                                    │
│   base_accounts AS (                    │
│     SELECT * FROM accounts              │
│   ),                                    │
│   parent_numbers AS (                   │
│     SELECT DISTINCT                     │
│       regexp_replace(number, '-[^-]+$', │
│       '') as parent_prefix              │
│     FROM base_accounts                  │
│     WHERE number LIKE '%-%'             │
│   )                                     │
│ SELECT ba.*,                            │
│   EXISTS(SELECT 1 FROM parent_numbers   │
│          WHERE parent_prefix = ba.number│
│   ) as has_analytics                    │
│ FROM base_accounts ba                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ PRZEWIDYWANY EXPLAIN:                   │
│ - 1 pełny skan accounts (6475 rows)     │
│ - 1 agregacja regexp na ~4000 rows      │
│ - 1 hash join na prefiksach             │
│ - Execution Time: <500 ms ✓             │
└─────────────────────────────────────────┘
```

