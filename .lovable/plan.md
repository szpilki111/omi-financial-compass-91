
# Szczegółowy plan naprawy 10 zgłoszonych problemów

## Podsumowanie problemów

| # | Problem | Priorytet | Pliki do modyfikacji |
|---|---------|-----------|---------------------|
| 1 | Raport grudniowy nie przelicza kwot dla proboszcza | KRYTYCZNY | `ReportDetails.tsx`, `financeUtils.ts` |
| 2 | Blokada dokumentów gdy istnieje raport roboczy | WYSOKI | `check_report_editing_blocked` (SQL), `DocumentDialog.tsx` |
| 3 | Dodanie konta "416 - Wydawnictwa" do raportu | NISKI | `accountNames.ts` |
| 4 | Ograniczenia kont nie działają | KRYTYCZNY | `get_user_filtered_accounts_with_analytics` (SQL) |
| 5 | Enter w AccountCombobox wybiera pierwszy element zamiast podświetlonego | ŚREDNI | `AccountCombobox.tsx` |
| 6 | Lista miesięcy chowa się za paskiem przeglądarki | ŚREDNI | `select.tsx` lub `ReportForm.tsx` |
| 7 | Formatowanie kwot od 4 cyfr | NISKI | `formatUtils.ts` - już działa poprawnie |
| 8 | Podsumowanie obrotów kont analitycznych | WYSOKI | `AccountSearchPage.tsx` |
| 9 | Dokumenty walutowe z przeliczaniem kursu | DUŻY ZAKRES | Nowa funkcjonalność |
| 10 | Import MT940 z PKO BP - format z podpolami ~20-~63 | WYSOKI | `Mt940ImportDialog.tsx` |

---

## Problem 1: Raport grudniowy nie przelicza kwot dla proboszcza

### Analiza przyczyny
Po przeanalizowaniu kodu `ReportDetails.tsx` (linia 371):
```typescript
{(report.status === 'draft' || canResubmit) && (user?.role === 'ekonom' || user?.role === 'proboszcz') && (
```

Proboszcz powinien mieć dostęp do przycisku "Złóż raport". Sprawdziłem też `canResubmit`:
```typescript
const canResubmit = user?.role === 'ekonom' && report?.status === 'to_be_corrected';
```

**Problem:** `canResubmit` działa tylko dla ekonoma. Proboszcz z raportem `to_be_corrected` nie może ponownie złożyć.

**Dodatkowy problem:** W `calculateFinancialSummary` (financeUtils.ts) nie ma żadnego specjalnego traktowania grudnia. Grudzień powinien działać tak samo jak inne miesiące. Problem może leżeć w obliczaniu dat:
```typescript
const firstDayOfMonth = new Date(year, month - 1, 1); // dla month=12 → Date(2025, 11, 1) = 1 grudnia 2025
const lastDayOfMonth = new Date(year, month, 0);     // dla month=12 → Date(2025, 12, 0) = 31 grudnia 2025
```

Ta logika jest poprawna. **Prawdopodobna przyczyna: inna logika RLS lub problem z user_locations dla proboszcza.**

### Rozwiązanie
1. Rozszerzyć `canResubmit` aby działał też dla proboszcza:
```typescript
const canResubmit = (user?.role === 'ekonom' || user?.role === 'proboszcz') && report?.status === 'to_be_corrected';
```

2. Dodać szczegółowe logowanie w `ReportDetails.tsx` dla diagnozy problemu z grudniem
3. Sprawdzić czy proboszcz ma poprawne przypisanie w `user_locations`

### Pliki do modyfikacji
- `src/pages/Reports/ReportDetails.tsx` - linia 124

---

## Problem 2: Blokada dokumentów gdy istnieje raport roboczy (draft)

### Analiza
Obecna funkcja SQL `check_report_editing_blocked` sprawdza tylko statusy `submitted` i `approved`:
```sql
AND status IN ('submitted', 'approved')
```

Użytkownik chce, aby raport w statusie `draft` również blokował tworzenie dokumentów.

### Rozwiązanie
Zmodyfikować funkcję SQL, aby uwzględniała status `draft`:
```sql
CREATE OR REPLACE FUNCTION public.check_report_editing_blocked(p_location_id uuid, p_document_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  report_exists boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM reports 
    WHERE location_id = p_location_id
      AND year = EXTRACT(YEAR FROM p_document_date)
      AND month = EXTRACT(MONTH FROM p_document_date)
      AND status IN ('draft', 'submitted', 'approved')  -- Dodano 'draft'
  ) INTO report_exists;
  
  RETURN report_exists;
END;
$function$;
```

### Pliki do modyfikacji
- Nowa migracja SQL

---

## Problem 3: Dodanie konta "416 - Wydawnictwa"

### Analiza
W pliku `accountNames.ts` brakuje konta 416.

### Rozwiązanie
Dodać do tablicy `EXPENSE_ACCOUNTS`:
```typescript
{ prefix: '416', name: 'Wydawnictwa' },
```

### Pliki do modyfikacji
- `src/constants/accountNames.ts`

---

## Problem 4: Ograniczenia kont nie działają

### Analiza
Funkcja `get_user_filtered_accounts_with_analytics` **NIE** sprawdza tabeli `account_category_restrictions`!

Obecna logika (linie 96-109 migracji):
```sql
WITH location_matched_accounts AS (
  SELECT a.id FROM accounts a
  WHERE ... AND split_part(a.number, '-', 2) || '-' || split_part(a.number, '-', 3) = loc_id
  UNION
  SELECT la.account_id FROM location_accounts la WHERE ...
)
```

**Brak filtrowania po `account_category_restrictions`!**

### Rozwiązanie
Zmodyfikować funkcję SQL aby:
1. Pobierać `category_prefix` lokalizacji użytkownika (pierwsza cyfra `location_identifier`)
2. Filtrować konta których prefiks jest zablokowany dla tej kategorii

```sql
-- Pobierz kategorię lokalizacji (pierwsza cyfra location_identifier)
SELECT ARRAY_AGG(DISTINCT LEFT(l.location_identifier, 1)) INTO v_category_prefixes
FROM locations l
WHERE l.id = ANY(v_location_ids) AND l.location_identifier IS NOT NULL;

-- W zapytaniu dodaj filtr:
AND NOT EXISTS (
  SELECT 1 FROM account_category_restrictions acr
  WHERE acr.account_number_prefix = split_part(a.number, '-', 1)
    AND acr.category_prefix = ANY(v_category_prefixes)
    AND acr.is_restricted = true
)
```

### Pliki do modyfikacji
- Nowa migracja SQL modyfikująca `get_user_filtered_accounts_with_analytics`

---

## Problem 5: Enter wybiera pierwszy element zamiast podświetlonego

### Analiza
W `AccountCombobox.tsx` (linie 251-265):
```typescript
} else if (e.key === 'Enter') {
  e.preventDefault();
  const firstAccount = filteredAccounts[0];  // <-- ZAWSZE pierwszy!
  if (firstAccount) {
    onChange(firstAccount.id);
```

**Problem:** Kod zawsze wybiera `filteredAccounts[0]`, ignorując aktualnie podświetlony element przez `cmdk`.

### Rozwiązanie
Biblioteka `cmdk` automatycznie obsługuje Enter dla podświetlonego elementu. Problem polega na tym, że `onKeyDown` przechwytuje Enter przed `cmdk`. Rozwiązanie:

```typescript
} else if (e.key === 'Enter') {
  // NIE blokuj domyślnej obsługi cmdk - pozwól wybrać podświetlony element
  // Usuń całą obsługę Enter lub dodaj:
  
  // Pobierz aktualnie podświetlony element
  const selectedElement = document.querySelector('[cmdk-item][data-selected="true"]');
  if (selectedElement) {
    const selectedId = selectedElement.getAttribute('data-value');
    if (selectedId) {
      e.preventDefault();
      onChange(selectedId);
      setOpen(false);
      setSearchTerm('');
      setShouldAutoOpen(false);
      if (onAccountSelected) {
        setTimeout(() => onAccountSelected(), 100);
      }
    }
  }
}
```

### Pliki do modyfikacji
- `src/pages/Documents/AccountCombobox.tsx` (linie 251-265)

---

## Problem 6: Lista miesięcy chowa się za paskiem przeglądarki

### Analiza
Problem dotyczy komponentu `Select` z Radix UI. Domyślnie `position="popper"` sprawia, że lista rozwija się względem viewportu, nie elementu rodzica.

### Rozwiązanie
1. Dodać `max-height` i przewijanie do `SelectContent`:
```typescript
<SelectContent className="max-h-[300px] overflow-y-auto">
```

2. Lub zmienić `position` na `item-aligned`:
```typescript
<SelectContent position="item-aligned">
```

3. Preferowane rozwiązanie - ograniczyć wysokość listy:
```typescript
// W ReportForm.tsx dla selectu miesięcy
<SelectContent className="max-h-[200px]">
```

### Pliki do modyfikacji
- `src/pages/Reports/ReportForm.tsx` (linia 461-477)

---

## Problem 7: Formatowanie kwot od 4 cyfr

### Analiza
Plik `formatUtils.ts` używa `Intl.NumberFormat('pl-PL')` który automatycznie dodaje separator tysięcy.

Testując: `new Intl.NumberFormat('pl-PL').format(1000)` zwraca "1 000" ✓

**Problem może być w innych miejscach gdzie używane jest `toLocaleString` bez opcji lub niestandardowa funkcja.**

### Rozwiązanie
Przeszukać cały kod i zastąpić wszystkie wystąpienia:
- `value.toLocaleString('pl-PL')` → `formatNumber(value)` z `formatUtils.ts`
- `value.toFixed(2)` → `formatNumber(value)`

### Pliki do modyfikacji
- Wiele plików - użyć search & replace

---

## Problem 8: Podsumowanie obrotów kont analitycznych

### Analiza
Obecny kod w `AccountSearchPage.tsx` (linie 81-103) pobiera transakcje tylko dla wybranego konta:
```typescript
.or(`debit_account_id.eq.${selectedAccount.id},credit_account_id.eq.${selectedAccount.id}`)
```

Nie uwzględnia podkont analitycznych.

### Rozwiązanie
1. Najpierw pobrać wszystkie konta zaczynające się od wybranego numeru:
```typescript
const { data: relatedAccountIds } = useQuery({
  queryKey: ['related-accounts', selectedAccount?.number],
  queryFn: async () => {
    if (!selectedAccount) return [];
    const { data } = await supabase
      .from('accounts')
      .select('id')
      .or(`number.eq.${selectedAccount.number},number.like.${selectedAccount.number}-%`);
    return data?.map(a => a.id) || [selectedAccount.id];
  },
  enabled: !!selectedAccount
});
```

2. Użyć tych ID w zapytaniu o transakcje:
```typescript
const orConditions = relatedAccountIds
  .flatMap(id => [`debit_account_id.eq.${id}`, `credit_account_id.eq.${id}`])
  .join(',');
query.or(orConditions);
```

### Pliki do modyfikacji
- `src/pages/AccountSearch/AccountSearchPage.tsx`

---

## Problem 9: Dokumenty walutowe z przeliczaniem kursu

### Analiza
To jest **nowa funkcjonalność** wymagająca znacznych zmian:
1. Pole kursu walutowego na dokumencie
2. Przycisk przełączający widok PLN/waluta
3. Podsumowanie w PLN
4. Integracja z raportami

### Rozwiązanie (wysokopoziomowe)
1. Rozszerzyć tabelę `documents` o:
   - `show_in_currency` (boolean) - flaga widoku
   
2. W `DocumentDialog.tsx`:
   - Dodać pole input dla kursu (już jest `exchange_rate`)
   - Dodać przycisk toggle widoku waluty
   - Obliczać wartości PLN = kwota * kurs
   
3. Podsumowanie dokumentu:
   - Zawsze pokazywać sumę w PLN na dole
   
4. W raportach:
   - Pobierać `amount * exchange_rate` dla dokumentów walutowych

### Pliki do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx`
- `src/pages/Documents/InlineTransactionRow.tsx`
- `src/utils/financeUtils.ts`
- Potencjalnie nowa migracja SQL

---

## Problem 10: Import MT940 z PKO BP - format z podpolami ~20-~63

### Analiza szczegółowa formatu PKO BP
Obecny parser używa separatora `^` (caret):
```typescript
const parts = currentDetails.split('^');
```

**Format PKO BP używa `~` (tylda) jako separatora podpól!**

Przykład z PKO BP:
```
:86:020~00152
~20FAKTURA NR. 1106676983
~21ÿ
~22ÿ
...
~32DHL ECOMMERCE SP. Z O. O. U
~33L. OSMAÑSKA 2, 02-823 WARSZ
~38PL27103019995019280622434897
```

### Rozwiązanie
Zmodyfikować parser w `Mt940ImportDialog.tsx`:

```typescript
const extractDescription = (detailsLine: string): string => {
  let description = 'Operacja bankowa';
  
  // Wykryj format (^ lub ~)
  const separator = detailsLine.includes('~') ? '~' : '^';
  
  if (!detailsLine || !detailsLine.includes(separator)) {
    return description;
  }

  const parts = detailsLine.split(new RegExp(`(?=${separator}[0-9]{2})`));
  let descParts: string[] = [];

  for (const part of parts) {
    // Podpola 20-25 = tytuł operacji
    // Format PKO: ~20TEKST lub ^20TEKST
    const match = part.match(new RegExp(`^${separator}(2[0-5])(.*)`, 's'));
    if (match) {
      const content = match[2].trim();
      // Ignoruj "ÿ" (ASCII 255) - puste pole w PKO BP
      if (content && content !== 'ÿ' && content.charCodeAt(0) !== 255) {
        descParts.push(content);
      }
    }
  }

  if (descParts.length > 0) {
    description = descParts.join(' ').replace(/\s+/g, ' ').trim();
  }

  return description;
};

const extractCounterparty = (detailsLine: string): { name: string; account: string } => {
  const separator = detailsLine.includes('~') ? '~' : '^';
  const parts = detailsLine.split(new RegExp(`(?=${separator}[0-9]{2})`));
  
  let counterparty = '';
  let accountNumber = '';

  for (const part of parts) {
    const fieldMatch = part.match(new RegExp(`^${separator}([0-9]{2})(.*)`));
    if (!fieldMatch) continue;
    
    const fieldNum = fieldMatch[1];
    const content = fieldMatch[2].trim();
    
    // Ignoruj puste pola (ÿ)
    if (!content || content === 'ÿ' || content.charCodeAt(0) === 255) continue;
    
    if (fieldNum === '32' || fieldNum === '33') {
      // Podpola 32-33 = nazwa kontrahenta
      counterparty += (counterparty ? ' ' : '') + content;
    } else if (fieldNum === '38') {
      // Podpole 38 = IBAN kontrahenta
      accountNumber = content;
    }
  }

  return { name: counterparty, account: accountNumber };
};
```

### Pliki do modyfikacji
- `src/pages/Documents/Mt940ImportDialog.tsx` - funkcje `extractDescription` i `parseMt940File`

---

## Kolejność implementacji

1. **KRYTYCZNE (natychmiast):**
   - Problem 1: Raport grudniowy dla proboszcza
   - Problem 4: Ograniczenia kont

2. **WYSOKIE (szybko):**
   - Problem 2: Blokada dokumentów przy raporcie draft
   - Problem 10: Parser MT940 PKO BP
   - Problem 8: Podsumowanie kont analitycznych

3. **ŚREDNIE:**
   - Problem 5: Enter w AccountCombobox
   - Problem 6: Lista miesięcy

4. **NISKIE:**
   - Problem 3: Konto 416
   - Problem 7: Formatowanie (prawdopodobnie już działa)

5. **DUŻY ZAKRES (osobna iteracja):**
   - Problem 9: Dokumenty walutowe

---

## Szacowany czas

| Etap | Czas |
|------|------|
| Problem 1 (raport grudniowy) | 1h |
| Problem 4 (ograniczenia kont) | 2h |
| Problem 2 (blokada draft) | 0.5h |
| Problem 10 (MT940 PKO) | 2h |
| Problem 8 (konta analityczne) | 1.5h |
| Problem 5 (Enter) | 1h |
| Problem 6 (lista miesięcy) | 0.5h |
| Problem 3 (konto 416) | 0.25h |
| Problem 7 (formatowanie) | 0.5h |
| Problem 9 (waluty) | 4-6h |
| **RAZEM** | **~14 godzin** |
