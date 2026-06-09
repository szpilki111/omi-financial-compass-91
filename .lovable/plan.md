## Decyzja

Po rozmowie: formuły są poprawne, problem to tylko **stary snapshot raportu** wygenerowany przed fix-em. Nie ruszamy mapowania `province` (zostaje `[201]`), nie wprowadzamy filtra 201↔200. Wystarczy umożliwić przeliczenie istniejącego raportu bez usuwania.

## Co zrobię

### 1. Przycisk „Przelicz dane raportu"

W `ReportDetails.tsx`, dla statusu `draft` i ról `admin` / `prowincjal`, dodaję przycisk **„Przelicz dane raportu"**. Po kliknięciu:

- pobiera transakcje po kontach domu (segmenty 2-3 = `location_identifier`) za miesiąc raportu — ta sama logika co w `ReportViewFull.tsx` (po ostatniej poprawce),
- liczy salda otwarcia z transakcji do końca poprzedniego miesiąca,
- nadpisuje wpisy w `report_entries`, `report_account_details`, `report_details` (sekcje: przychody 7xx, koszty 4xx, status finansowy 1xx, należności/zobowiązania 2xx, intencje 210),
- pokazuje toast „Raport przeliczony" i odświeża widok.

Dzięki temu O. Ossowski klika i widzi nowe wartości — bez usuwania raportu i bez ryzyka utraty komentarzy/załączników.

### 2. Wspólny hook `useReportRecalculation`

Wyciągam logikę pobierania i agregacji z `ReportViewFull.tsx` do `src/hooks/useReportRecalculation.ts`, żeby przycisk i widok korzystały z **tej samej** funkcji liczącej. Eliminuje to ryzyko rozjazdu w przyszłości.

### 3. Drobny tooltip w nagłówku „Rozliczenia z prowincją"

W `ReportLiabilitiesTable.tsx` ikonka „i" obok nagłówka sekcji:

> Saldo obejmuje wszystkie księgowania na kontach 201 placówki, w tym zatwierdzone subwencje z prowincji (Wn 201). Wpływy kasowe zmniejszają należność po stronie Ma.

Pomaga uniknąć podobnych pytań w przyszłości.

## Pliki

- `src/hooks/useReportRecalculation.ts` — **nowy**, wspólna logika przeliczenia.
- `src/components/reports/ReportViewFull.tsx` — refactor: użycie wspólnego hooka zamiast inline-query.
- `src/components/reports/ReportDetails.tsx` — przycisk „Przelicz dane raportu".
- `src/components/reports/ReportLiabilitiesTable.tsx` — tooltip.

## Poza zakresem

- Zmiana mapowania `province` na `[201, 200]` lub filtr 201↔200 — nie ruszamy.
- Status dokumentów po usunięciu raportu — działa po migracji z 03.06, potwierdzone przez O. Ossowskiego.