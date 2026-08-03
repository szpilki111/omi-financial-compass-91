# Poprawka „Obroty i salda – globalnie” + wycena „Edytuj operację”

## Część 1 — Poprawka do wykonania teraz (w cenie)

### Problem (potwierdzony w kodzie)
W `GlobalAccountTurnovers.tsx` przypisanie wiersza do placówki opiera się na `transactions.location_id`, a nie na numerze konta. Skutek: wybierając placówkę „Prowincja” dla konta 100 lub 110, w wynikach pojawiają się także konta innych domów i parafii (np. `110-2-13-1`), bo dokument został zaksięgowany przez Prowincję. Sumy sald końcowych są wtedy niezgodne z rzeczywistością.

### Rozwiązanie
- Placówkę wiersza ustalać na podstawie **segmentów numeru konta** (segment 2 i 3), dopasowanych do `locations.location_identifier` — identycznie jak w naprawionym raporcie miesięcznym (`ReportViewFull.tsx`).
- Dopasowanie ścisłe po segmentach, nie `LIKE`: identyfikator „1” (Prowincja) obejmuje wyłącznie konta `100-1`, `110-1-…`, a nie `100-2-13`; identyfikator „2-10” nie może łapać `…-4-2-10`.
- Gdy wybrano konkretną placówkę, filtrować transakcje po kontach tej placówki **przed** agregacją (mniej danych, szybsze zapytanie).
- Konta bez rozpoznanej placówki trafiają do wiersza „(nieprzypisane)”, żeby nic nie ginęło w sumach.
- Drill-down do transakcji, eksport XLSX i oba wykresy korzystają z tej samej, poprawionej logiki dopasowania.

### Techniczne
Plik: `src/pages/Administration/GlobalAccountTurnovers.tsx`
- Nowy helper `locationIdForAccount(number)` budowany raz z listy placówek (mapa `identifier → location`), sprawdzający `parts[1]`/`parts[2]`.
- W `apply()` zamiana `tx.location_id` na wynik helpera dla konta danej strony zapisu.
- Filtry drill-down (`drillRow.locationId`) i eksport przełączone na to samo dopasowanie.

## Część 2 — Do wyceny (NA RAZIE NIE REALIZUJEMY)

### „Edytuj operację” — edycja pojedynczego zapisu z listy operacji konta
Dziś przycisk „Edytuj” na liście operacji (Wyszukaj konta) otwiera **cały dokument** i użytkownik musi w nim szukać właściwej kwoty. Propozycja: dodać obok drugi przycisk „Edytuj operację”, który otwiera okno tylko z tym jednym zapisem (opis, kwota Wn/Ma, konto Wn/Ma, waluta i kurs), z zapisem bez wchodzenia w dokument.

Zakres prac:
1. Rozszerzenie listy operacji: drugi przycisk + rozróżnienie „Edytuj dokument” / „Edytuj operację”. (1 h)
2. Adaptacja istniejącego `TransactionEditDialog` do trybu samodzielnego (pobranie zapisu z bazy, kontekst dokumentu, waluta dokumentu). (3 h)
3. Zapis do bazy z pełną walidacją regułową: blokada dokumentów w stanie „przesłany/zatwierdzony”, blokada zmiany miesiąca, ograniczenia kont analitycznych i kont zastrzeżonych. (4 h)
4. Spójność dokumentu po edycji: przeliczenie bilansu Wn/Ma dokumentu, obsługa zapisów podzielonych (split) oraz automatycznych wierszy „procent na prowincję” (zablokowana edycja wiersza auto lub przeliczenie po zmianie kwoty źródłowej). (4 h)
5. Odświeżenie widoków po zapisie (lista operacji, obroty miesięczne, salda, raporty) i zachowanie pozycji przewijania. (1,5 h)
6. Ten sam przycisk w widoku „Obroty i salda – globalnie” (drill-down transakcji). (1,5 h)
7. Uprawnienia i audyt: kto może edytować pojedynczy zapis, wpis do dziennika zmian. (1,5 h)
8. Testy na danych rzeczywistych (waluty, split, procent na prowincję, dokumenty zablokowane) + poprawki po testach. (3,5 h)

**Razem: 20,5 h** — w zaokrągleniu **20–21 h**.

Wariant minimalny (bez punktów 6 i 7, edycja tylko opisu i kwoty, bez zmiany kont): **10 h**.

Ryzyko: edycja pojedynczego zapisu może rozbilansować dokument, dlatego walidacja bilansu i obsługa wierszy automatycznych to najistotniejsza część pracy — bez niej funkcja psułaby raporty.
