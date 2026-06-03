## Plan

### 1. Wykres kołowy — usunąć szary kolor

`src/pages/Administration/GlobalAccountTurnovers.tsx` — paleta `CHART_COLORS` używa odcieni `#e5e7eb`/`#cbd5e1` (jasnoszare segmenty są nieczytelne). Zamienię szare na czytelne, kontrastowe (np. cyan, teal, lime, amber-dark, rose, indigo), bez powtarzania już użytych kolorów. Pozostałe (granat, czerwień, fiolet, zieleń itd.) zostają.

### 3. Import formularza Excel — konto „440-2-9" mylnie zgłaszane jako nieistniejące

Przyczyna: w `src/pages/Documents/ExcelFormImportDialog.tsx` funkcja `findAccount`:

- gdy numer (`440-2-9`) jest kontem **syntetycznym** z wieloma podkontami analitycznymi (`440-2-9-1`, `440-2-9-2`), zwraca `undefined` ⇒ komunikat „Nie znaleziono konta 440-2-9".

Naprawa: rozróżnić dwa przypadki:

- **brak konta w ogóle** → komunikat: „Nie znaleziono konta {nr}".
- **konto istnieje, ale wymaga wyboru analityki** → komunikat: „Konto {nr} ma kilka podkont analitycznych — wybierz właściwe ręcznie w wierszu" + wiersz pozostaje do uzupełnienia (jak dotychczas), ale **nie blokuje** importu (importowanie z pustym kontem już teraz odbywa się ręcznie po edycji).

Dodatkowo dodam podpowiedź w UI listy błędów: pokażę dostępne podkonta liściowe (do 3 propozycji) zamiast tylko „Nie znaleziono".

### 2. Raporty miesięczne rozjeżdżają się z rzeczywistością (sekcja „Rozliczenia z prowincją")

Status: **diagnostyka, nie naprawa w tym kroku** — potrzebuję potwierdzenia, której placówki / którego miesiąca dotyczy załączony zrzut (konto 201-2-15 należy do *Domu Zakonnego w Poznaniu*, nie do WSD widocznego na zrzucie raportu).

Plan działania:

1. Zidentyfikować raport (`location_id` + miesiąc) na podstawie odpowiedzi użytkownika.
2. Wyciągnąć z bazy: wszystkie transakcje danej placówki za miesiąc z kont `201-*` (debit i credit), porównać sumy Wn/Ma z tym co pokazuje `ReportViewFull.tsx`.
3. Sprawdzić, czy występują transakcje wewnętrzne (`201-*` ↔ `201-*`) lub generowane automatycznie przez prowizję prowincjalną — w `ReportViewFull.tsx` (linie 200–295) nie ma żadnego filtrowania międzykontowego, więc każda taka transakcja jest liczona zarówno po stronie Wn jak i Ma. **Może to być prawidłowe, ale wymaga potwierdzenia z użytkownikiem.**
4. Jeśli okaże się że transakcje wewnątrz `201-*` zawyżają obie strony, dodać filtr: pomijać transakcje, w których **oba** konta (debit i credit) zaczynają się od tego samego prefiksu kategorii zobowiązań.

### 4. Raport za luty — podwójna subwencja + zablokowany raport roboczy

Status: **diagnostyka, nie naprawa w tym kroku** — bez identyfikacji konkretnej placówki/raportu nie da się jednoznacznie wskazać przyczyny.

Plan działania:

1. Sprawdzić mechanizm `useProvincialFee` (`src/hooks/useProvincialFee.ts`) i hak `generateProvincialFeesForImport` — czy przy imporcie + przy ręcznym dodaniu dokumentu z konta 200 nie powstaje **dwukrotny** wpis na 201 (raz auto-wygenerowany, raz ręcznie). Wytypowany dokument `PROW/2026/02/084` → przeczytać jego transakcje + audit log (`documents_audit_log`).
2. Sprawdzić w `documents` flagi `validation_errors` oraz status powiązanego `reports` (kolumna `status` w `reports`). Reguła z pamięci projektu: dokumenty `submitted/approved` są tylko do odczytu. Jeśli raport został zapisany jako `draft`, a dokumenty pozostały `submitted` (lub flaga utknęła), to potrzeba **odblokować dokumenty** po usunięciu/cofnięciu raportu — sprawdzić odpowiedni trigger / kod w `ReportApprovalActions.tsx` i `ReportDetails.tsx`.
3. Jeśli znajdę miejsce w kodzie, gdzie usunięcie raportu nie cofa locka dokumentów → poprawić, dodać migrację korekcyjną dla zaległych przypadków.
4. Jeśli okaże się że to wynik podwójnego generowania prowizji (sprawdzić `provincial_fee_account_exclusions`) → dodać `unique constraint`/idempotencję w `useProvincialFee.generateProvincialFeesForImport`.

### Pliki do edycji (tylko punkty 1 i 3 — pewne)

- `src/pages/Administration/GlobalAccountTurnovers.tsx` (paleta wykresu)
- `src/pages/Documents/ExcelFormImportDialog.tsx` (komunikat błędu + sugestie podkont)

### Pytania dla użytkownika (przed wejściem w punkty 2 i 4)

- **Punkt 2:** Której placówki dotyczy zrzut raportu (kwiecień 2026? `201-2-15` = Dom w Poznaniu)? Czy dokumenty z transakcjami `201-2-15` Ma były tworzone w innym miesiącu, czy w tym samym?
- **Punkt 4:** Która placówka i czy ten raport „roboczy" istnieje jeszcze w systemie, czy został już usunięty? Numer dokumentu „z konta 200", którego dotyczy podwójna subwencja.

&nbsp;

Odpowiedź użytkownika:

punkt 2: no przecież nie ma innej możliwości jak 2-15 to jest przecież identyfikator **Dom Zakonny Misjonarzy Oblatów Maryi Niepokalanej w Poznaniu** i ze screena widać, że to jest kwiecień, nie rozumiem skąd to pytanie. Wszystko tu jest jasne jak dla mnie. Sprawdź sytuacje za kwiecień i ewnetualnie jak znajdziesz błąd, to sprawdź sytuację we wszyskich innych powiązanych miejscach.

punkt 4: przecież sam możesz sprawdzić czy raport za luty istnieje i jaki ma status, a numer dokumentu, jaki użytkownik podał to PROW/2026/02/084 Sprawdź sytuację bazując na tych informacjach i zobaczy czy dokuemnty mogą być edytowane przy wygenerowaniu nawet roboczego raportu i czy dokumenty z lutego są odblokwane do edycji w przypadku usunięcia raportu z lutego.