# Dokończenie wyceny: kontrola krzyżowa, dokument testowy, „Edytuj operację”

## Stan sprawdzony w kodzie (co już jest zrobione)

- Wspólna logika przypisania placówki po segmentach numeru konta istnieje
  (`src/utils/locationAccountMatching.ts`) i jest już użyta w: `GlobalAccountTurnovers`,
  `ReportViewFull`, `ExportToExcel`, `ReportAccountsBreakdown`, `YearToDateCashFlowBreakdown`,
  oba generatory PDF, `DataIntegrityReport`.
- Silnik obliczeń `src/utils/turnoverEngine.ts` + testy jednostkowe (Vitest, 35 przypadków) są na miejscu.
- Zakładka „Spójność danych” w administracji jest podpięta.
- `YearToDateAccountsBreakdown` nie filtruje po `location_id` — nie wymaga zmiany.
- Poprawka z rozmowy (wybór „Prowincja” zasysał konta innych domów) jest już wdrożona
  w widoku globalnym; weryfikacja poniżej to potwierdzi na realnych danych.

Zostają więc: część 2B (kontrola krzyżowa), 2C (dokument), jedno miejsce z part. 1
(`financeUtils`) oraz osobno wyceniona funkcja „Edytuj operację”.

## Zakres 1: dokończenie ujednolicenia

- `src/utils/financeUtils.ts` — podsumowanie finansowe pulpitu nadal filtruje zapisy po
  `location_id` dokumentu (linie ~45, ~177). Przejście na dopasowanie po segmentach numeru konta
  (`resolveLocationIdForAccount`), z paginacją `fetchAllRows` i deterministycznym `order('id')`.
- Weryfikacja na danych: dla konta 100-1 i 110-1 (Prowincja, wybrane miesiące) porównanie wyniku
  widoku globalnego z „Wyszukaj konta” — potwierdzenie, że nie wchodzą konta innych domów.

## Zakres 2B: kontrola krzyżowa na danych rzeczywistych

Nowa zakładka administracyjna „Kontrola zgodności obliczeń” (tylko admin):

- wybór roku i zestawu bloków kont (100, 101, 110, 200, 201, 210, 4xx, 7xx),
- dla każdej placówki i każdego miesiąca liczy trzy ścieżki: obroty globalne
  (`turnoverEngine` per placówka), agregację per pełny numer konta (`aggregateByAccount`)
  i sumę raportu miesięcznego,
- tabela rozjazdów: konto, placówka, miesiąc, wartości z trzech źródeł, kwota różnicy;
  pusta tabela = zgodność,
- kontrola „suma wierszy = RAZEM” dla każdego przebiegu,
- eksport wyniku do XLSX, żeby dało się przesłać zgłoszenie z konkretami,
- postęp przebiegu (miesiąc/blok), przerwanie w trakcie, wszystkie zapytania przez `fetchAllRows`.

Po uruchomieniu: przejście listy rozjazdów i poprawki wykrytych błędów obliczeń.

## Zakres 2C: dokument kontrolny dla Ojców

Arkusz XLSX + krótka instrukcja (PL) do wpisywania kwot z Symfonii: konto, placówka, miesiąc,
saldo początkowe, Wn, Ma, saldo końcowe, kolumna „wynik programu” i „różnica”, oraz instrukcja
zgłaszania rozjazdu (co podać, by dało się odtworzyć). Dostępny do pobrania z zakładki kontroli
zgodności.

## Zakres 3: „Edytuj operację” (osobna wycena z rozmowy)

Dziś w „Wyszukaj konta” przycisk „Edytuj” otwiera cały dokument i trzeba szukać kwoty.

- Rozdzielenie na dwie akcje w wierszu operacji: „Edytuj dokument” (jak dziś) i „Edytuj operację”.
- „Edytuj operację” otwiera istniejący `TransactionEditDialog` z jedną wskazaną operacją:
  data, opis, konto Wn/Ma, kwota, waluta i kurs, zapis pojedynczego wiersza.
- Zachowanie reguł: blokada edycji w okresie zamkniętym (raport złożony/zatwierdzony),
  spójność z numerem dokumentu i datą, ograniczenia kont placówki, wiersze „procent na prowincję”
  tylko do odczytu, walidacja bilansu dokumentu po zapisie z ostrzeżeniem przy rozjeździe.
- Po zapisie odświeżenie listy operacji i obrotów bez przeładowania strony.
- Ta sama akcja w podglądzie operacji w widoku globalnym (drill-down).

## Techniczne

- Nowy `src/pages/Administration/CalculationConsistencyCheck.tsx` + wpis w
  `AdministrationPage.tsx` (zakładka admin-only).
- Logika porównań w nowym `src/utils/consistencyCheck.ts` (czysta, bez Supabase) + testy Vitest.
- `financeUtils` refaktor na `resolveLocationIdForAccount`, testy jednostkowe agregacji pulpitu.
- „Edytuj operację”: rozszerzenie `TransactionsList` o `onEditTransaction`, reużycie
  `TransactionEditDialog` w `AccountSearchPage` i w drill-downie `GlobalAccountTurnovers`.
- Generowanie arkusza kontrolnego przez `xlsx` (biblioteka już w projekcie).

## Godziny (zgodnie z wyceną)

| Część | Zakres | Godziny |
| --- | --- | --- |
| 1 | `financeUtils` + weryfikacja Prowincji na danych | 1,5 |
| 2B | Strona kontroli krzyżowej + eksport | 5 |
| 2B | Przejście wyników i poprawki rozjazdów | 4 |
| 2C | Arkusz i instrukcja dla Ojców | 2 |
| 3 | „Edytuj operację” (dialog, reguły blokad, walidacja, 2 miejsca) | 8 |
| — | Testy końcowe i poprawki | 3 |

Razem: **23,5 h** (z czego 12,5 h to pozostała część pakietu 36 h, 8 h to nowa funkcja
„Edytuj operację”, 3 h testy końcowe).
