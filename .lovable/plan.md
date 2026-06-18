## Problem

Użytkownik (parafia Wrocław) zgłasza, że w **eksporcie Excel raportu miesięcznego** kwoty w sekcji „Rozliczenia z prowincją" (konto 201) są inne niż:
- to, co widać w obrotach kont (Account Search),
- to, co pokazuje raport miesięczny w UI (`ReportViewFull`).

## Przyczyna

`src/components/reports/ExportToExcelFull.tsx` pobiera transakcje z filtrem **`.eq("location_id", location_id)`** — zarówno dla salda otwarcia (linie 104–118), jak i dla obrotów bieżącego miesiąca (linie 145–160).

Tymczasem `ReportViewFull.tsx` (UI raportu) używa innej, poprawnej strategii: pobiera **wszystkie konta placówki** (po `location_identifier`, segmenty 2 i 3 numeru konta) i ściąga transakcje, których którakolwiek strona (Wn lub Ma) wskazuje te konta — **niezależnie od `location_id` transakcji**.

To kluczowe dla rozliczeń z prowincją: gdy **Prowincja** księguje dokument (np. `PROW/2026/02/084`) na koncie placówki `201-3-…-*` (subwencja, zatwierdzona kontrybucja itd.), taka transakcja ma `location_id` Prowincji, a nie parafii. Tooltip w `ReportLiabilitiesTable.tsx` (linie 50–53) wprost mówi, że saldo 201 musi obejmować również wpisy generowane przez Prowincję — UI to robi, eksport nie.

Efekt: eksport pomija transakcje Prowincji na kontach 201-x-y-* parafii → inne (mniejsze) kwoty w sekcji „C. Rozliczenia z prowincją" oraz w saldzie otwarcia/zamknięcia.

## Zakres zmian

Plik: `src/components/reports/ExportToExcelFull.tsx`

1. **Zreplikować logikę z `ReportViewFull`** — pobrać `homeAccountIds` i `homeAccountNumbers` placówki na podstawie `location_identifier` i ścisłego dopasowania segmentów 2 i 3 numeru konta (z fallbackiem dla jednoczłonowego identyfikatora typu „1" = Prowincja).

2. **Zamienić oba zapytania o transakcje** (otwarcie + bieżący miesiąc) na pobieranie po stronach Wn/Ma odwołujących się do `homeAccountIds`:
   - Paczki po 300 ID (limit długości URL PostgREST), równolegle dla `debit_account_id` i `credit_account_id`.
   - Deduplikacja po `id` transakcji.
   - Zachować obecny zakres dat (`lte prevMonthEndStr` / `gte..lte` dla bieżącego miesiąca).

3. **Filtrowanie po stronie księgowania** — w pętli sumującej obroty i salda otwarcia uwzględniać kwotę dla strony Wn/Ma **tylko jeśli** dane konto należy do `homeAccountNumbers` (analogicznie jak w `ReportViewFull`, linie 195+). Zapobiega to liczeniu drugiej strony przeciwstawnej księgowania, która należy do innej placówki.

4. **Bez zmian**: cała pozostała logika eksportu (mapowanie kategorii, mapowania zobowiązań per-location, formatowanie, układ arkuszy, sekcja „Świadczenia na prowincję" tylko dla `isDom`, czcionki, marginesy).

## Weryfikacja

- Otworzyć raport miesięczny parafii Wrocław za miesiąc zgłoszony przez użytkownika.
- Porównać sekcję „C. Należności i zobowiązania" → wiersz „3. Rozliczenia z prowincją" (Początek, Należności, Zobowiązania, Koniec) w UI vs. wyeksportowany Excel — kwoty muszą być **identyczne**.
- Sprawdzić, że suma A (Stan finansowy) i suma I/II (Przychody/Rozchody) w eksporcie nadal zgadzają się z UI (te nie powinny się zmienić w typowych przypadkach, ale logika będzie spójna).

## Czego NIE zmieniam

- Brak zmian w bazie danych / RLS / migracji.
- Brak zmian w `ReportViewFull`, `ReportLiabilitiesTable`, `ReportAccountsBreakdown`.
- Brak zmian w innych raportach / KPiR / wyszukiwarce kont.
