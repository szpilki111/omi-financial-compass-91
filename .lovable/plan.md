## Cel

Naprawić 4 zgłoszone problemy: (1) brak analityki na kontach 200/201 przy automatycznym naliczaniu opłaty prowincjalnej, (2/3) błędne salda w sekcji „C. Należności i zobowiązania" raportu (Laskowice, Poznań, Obra), (4) potrzeba pełnej analityki dla każdego domu na 200 i 201.

---

## Problem 1 + 4 — Brak analityki dla naliczanego procentu (200/201)

### Diagnoza
W `useProvincialFee.createProvincialFeeTransaction` i `generateProvincialFeesForImport` używamy `resolveAccountByPrefix(prefix)`, który dopasowuje tylko pierwszy segment numeru konta (np. „201"). W efekcie wybiera konto syntetyczne lub przypadkowe konto bez analityki — nie konto domu (np. `201-2-10-1`).

Wymaganie użytkownika (Speaker 1):
- Dla konta wyzwalającego np. `702-3-1` w domu Zachutyń: opłata ma trafić na `200-2-20-3 / 201-2-20-1` (pełna analityka domu).
- Dla `719-...-6-1`: analogicznie pełna analityka domu.
- Czyli docelowe konto = `<prefix>-<identyfikator domu>-<analityka>`.

### Plan naprawczy

1. **Rozszerzenie `provincial_fee_accounts` o mapowanie docelowej analityki per prefix wyzwalający** (migracja):
   - Dodać kolumny:
     - `target_debit_subaccount` (text, nullable) – ostatni segment analityki dla strony Wn (np. `3`)
     - `target_credit_subaccount` (text, nullable) – analogicznie dla Ma (np. `1`)
   - Te wartości nadpisują globalne ustawienia `provincial_fee_settings.target_*_account_prefix` tylko w obrębie analityki.

2. **`useProvincialFee` – nowy resolver `resolveTargetAccountForLocation`**:
   - Wejście: `prefixGłówny` (np. `200`/`201`), `locationIdentifier` (np. `2-15`), `subAnaliza` (np. `1` lub `3`).
   - Buduje wzorzec: `${prefix}-${locationIdentifier}-${sub}` i znajduje konto o dokładnie takim numerze.
   - Fallback: jeśli nie istnieje, próbuje `${prefix}-${locationIdentifier}` (rodzic) i loguje ostrzeżenie.
   - Pobiera `location_identifier` z tabeli `locations` na podstawie `effectiveLocationId` (nowa zależność/hook lub przekazane z DocumentDialog).

3. **`createProvincialFeeTransaction` / `generateProvincialFeesForImport`**:
   - Zamiast `resolveAccountByPrefix(target_debit_account_prefix)` używać `resolveTargetAccountForLocation(prefix, locationIdentifier, subDebit)` i analogicznie dla credit.
   - Domyślne `subDebit`/`subCredit` można pobrać:
     - z nowych pól w `provincial_fee_accounts` (per prefix wyzwalający), lub
     - z analityki konta wyzwalającego (np. konto wyzwalające `200-2-15-6` ma sub=6, a opłata idzie na `200-2-15-{target_debit_subaccount}` – domyślnie `3` jeśli nie skonfigurowane).

4. **UI: `ProvincialFeeManagement.tsx`** – w wierszu każdego prefixu wyzwalającego dodać dwa małe pola input („Docelowa analityka Wn", „Docelowa analityka Ma") obok „% opłaty" i „Wykluczenia". Zapisywane do nowych kolumn.

5. **Walidacja**: jeżeli system nie znajdzie pełnego konta analitycznego, pokazać wyraźny `toast` z komunikatem zamiast cicho używać konta-rodzica. Zaproponować admina dodanie konta.

---

## Problem 2 + 3 — Błędne salda w „C. Należności i zobowiązania"

### Diagnoza
Plik `ReportLiabilitiesTable.tsx` (i analogicznie `ReportViewFull.tsx`, `ExportToExcelFull.tsx`, `ReportPDFGeneratorCompact.tsx`) ma sztywne mapowanie kategorii:

```
'3. Rozliczenia z prowincją' → ['201']
'4. Rozliczenia z innymi'    → ['217']
```

Tymczasem w bazie:
- Laskowice: `200-2-10` = „Rozliczenie z prowincją Laskowice", `201-2-10` = „Rozliczenie z domami". Czyli rozliczenie z prowincją siedzi pod prefiksem **200**.
- Poznań: `200-2-15` = „Rozliczenie z prowincją Poznań", `201-2-15` = „Rozliczenie z domami".

Aktualnie raport bierze wszystkie konta `201-*` z lokalizacji – w tym `201-2-15-3 (Inne rozliczenia z prowincją)` o dużych obrotach (np. wpis 41 400,08 z 2026-01-01). Stąd:
- Laskowice styczeń: pokazuje 19 419,37 zamiast 17 629,37 (różnica 1 790 ≈ obroty na 201-2-10-1/3 wmieszane w `Rozliczenia z prowincją`).
- Poznań styczeń: 38 681,80 zamiast 35 031,78 (różnica 3 649,02 — wpisy na 201-2-15-3).

### Plan naprawczy

1. **Konfigurowalne mapowanie kategorii bilansu per lokalizacja** – nowa tabela `report_liability_category_mappings`:
   - `id`, `location_id` (nullable = domyślne dla wszystkich), `category_key` ('loans_given'|'loans_taken'|'province'|'others'), `account_prefixes` (text[]), `display_order`.
   - Domyślne wpisy (gdy `location_id = NULL`): zachowują obecne mapowanie jako fallback.
   - Per lokalizacja administrator może np. ustawić: Laskowice → `province = ['200-2-10']`, Poznań → `province = ['201-2-15']`, itd. Mapowanie przyjmuje konkretne prefiksy z analityką (nie tylko pierwszy segment).

2. **Aktualizacja `ReportViewFull.tsx`** (i `ExportToExcelFull.tsx`, `ReportPDFGeneratorCompact.tsx`, `ReportPDFGenerator.tsx`):
   - Pobrać mapowanie z bazy (najpierw per `locationId`, fallback na domyślne).
   - Funkcję dopasowania zmienić z `prefix.startsWith('201')` na `prefix.startsWith(mappedPrefix)` lub `accountNumber.startsWith(mappedPrefix)` — dopasowanie do całego ciągu numeru konta, np. `201-2-15` (a nie tylko `201`).
   - **WAŻNE**: dotyczy zarówno sumy obrotów miesiąca (`receivables`/`liabilities`), jak i `getCategoryOpeningBalance` (saldo otwarcia) — obecnie tam też jest `prefix.startsWith(acc)`, co dla `acc='201-2-15'` zadziała poprawnie po zmianie struktury danych.
   - W `ReportViewFull.tsx` kalkulacja salda otwarcia – przechowuje balance per `prefix = number.split('-')[0]` (linia 78/86). Trzeba **przebudować** klucz na pełny numer konta lub wprowadzić wyszukiwanie sumujące po kontach pasujących do `mappedPrefix`. Najczystsze: zachować transakcje per `accountNumber` (cały numer), a w `getCategoryOpeningBalance` sumować wszystkie konta zaczynające się od dowolnego z mapowanych prefiksów.

3. **UI administratora**: Nowa zakładka w `Administracji` lub rozszerzenie istniejącej („Mapowanie kategorii raportu") — tabela z czterema kategoriami i polem multi-prefix per lokalizacja. Domyślnie pusta (= dziedziczy globalne).

4. **Migracja danych** – seed domyślnych mapowań:
   - `loans_given` → `['212','213']`
   - `loans_taken` → `['215']`
   - `province` → `['200','201']` (zsumować oba prefiksy w fallback, by uniknąć utraty danych w nieskonfigurowanych domach)
   - `others` → `['217']`

5. **QA**: po wdrożeniu uruchomić raport dla Laskowic i Poznania za styczeń 2026, porównać z wartościami oczekiwanymi (17 629,37 / 35 031,78). Sprawdzić też Obrę.

---

## Pliki do zmiany

- `src/hooks/useProvincialFee.ts` – nowy resolver, parametr `locationIdentifier`.
- `src/pages/Administration/ProvincialFeeManagement.tsx` – pola docelowej analityki w wierszach.
- `src/components/reports/ReportLiabilitiesTable.tsx` – usunąć sztywne `DEFAULT_LIABILITY_CATEGORIES` (lub trzymać jako fallback).
- `src/components/reports/ReportViewFull.tsx` – ładowanie mapowań, refaktor `getCategoryOpeningBalance` i agregacji per pełny numer konta.
- `src/components/reports/ExportToExcelFull.tsx`, `ReportPDFGeneratorCompact.tsx`, `ReportPDFGenerator.tsx` – ta sama zmiana logiki.
- Migracja SQL: nowe kolumny w `provincial_fee_accounts`, nowa tabela `report_liability_category_mappings` + seed.
- Aktualizacja `mem://features/administration/provincial-fee-auto-generation` i nowa notatka `mem://features/reports/liability-category-mappings`.

---

## Podsumowanie zmian dla użytkownika

1. Naliczanie 30% (i innych) trafi na **pełne konto z analityką domu** (np. `200-2-15-1` zamiast `200`). Konfigurowalne per prefix wyzwalający w Administracji.
2. Sekcja „C. Należności i zobowiązania" w raporcie będzie używać **konkretnych kont** (z analityką) zdefiniowanych dla każdej lokalizacji. Domyślnie sumuje 200 i 201, ale admin może doprecyzować np. Laskowice = 200-2-10, Poznań = 201-2-15.
3. Po zmianie raporty Laskowic, Poznania i Obry będą zgadzać się z saldami w wyszukiwarce kont.
