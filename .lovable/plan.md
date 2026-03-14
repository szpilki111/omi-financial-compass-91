
Cel: naprawić zgłoszenie „sumy przechodnie / konto 217 / niezgodne konto bankowe parafii” tak, żeby wyniki w `/wyszukaj-konta` były jednoznaczne i zgodne z księgowaniem.

Co już ustaliłem z kodu i danych:
1) Zgłoszenie dotyczy faktycznie strony `/wyszukaj-konta` (error report ma ten URL).
2) W dokumencie `BANK PARAFIA` (03/2026) pozycja 15 istnieje i ma zapis:
   - Wn `217-3-3-8` (Świetlica)
   - Ma `110-3-3-2` (PEKAO Świetlica)
3) To tłumaczy „nie zgadza się konto bankowe parafii” — ta pozycja nie dotyka konta `110-3-3-1` (Parafia), tylko `110-3-3-2` (Świetlica).
4) W kodzie `AccountSearchPage` są luki, które utrudniają poprawne śledzenie takich przypadków:
   - zapytania transakcji/salda nie filtrują po `location_id`,
   - lista i wydruk liczą stronę Wn/Ma po `selectedAccount.id` (konto dokładne), zamiast po całym zestawie `relatedAccountIds` (konto + analityki), co dla kont syntetycznych zniekształca odczyt.

Plan naprawy (wdrożeniowy):

1. Uszczelnienie danych w wyszukiwarce kont (najpierw)
- Plik: `src/pages/AccountSearch/AccountSearchPage.tsx`
- Dodać `.eq('location_id', user.location)` do:
  - query transakcji rocznych,
  - query salda otwarcia.
- Dzięki temu obroty/salda będą liczone wyłącznie dla bieżącej placówki.

2. Spójne liczenie dla kont syntetycznych i analitycznych
- Pliki:
  - `src/pages/AccountSearch/TransactionsList.tsx`
  - `src/pages/AccountSearch/PrintableAccountTurnover.tsx`
  - (oraz fragment eksportu Excel w `AccountSearchPage.tsx`)
- Przekazać `relatedAccountIds` do komponentów i wszędzie używać `Set(relatedAccountIds)` zamiast porównania tylko do `selectedAccount.id`.
- Skutek: Wn/Ma, saldo bieżące, wydruk i Excel będą liczone identycznie jak karta podsumowania na górze.

3. Lepsza czytelność pozycji „sumy przechodnie”
- `TransactionsList.tsx`: pokazywać jawnie kwotę po stronie Wn i Ma dla „wybranego zakresu kont” (related set), nie tylko jedną kwotę.
- To pozwala od razu zauważyć, że pozycja 15 księguje się na bank świetlicy (`110-3-3-2`), a nie parafii (`110-3-3-1`).

4. Twarda walidacja księgowa dla takich przypadków (ochrona na przyszłość)
- Plik: `src/pages/Documents/TransactionForm.tsx` (lub walidacja przed zapisem dokumentu)
- Dodać ostrzeżenie biznesowe:
  - jeśli użytkownik księguje operację „przeniesienie kapitału” między 217 a bankiem, pokazać komunikat weryfikacyjny, czy użyto właściwego konta bankowego (parafia vs świetlica).
- To nie blokuje pracy, ale redukuje podobne pomyłki danych.

5. Jednorazowa korekta danych dla zgłoszonej pozycji (po potwierdzeniu)
- Dotyczy konkretnej pozycji 15 z marca (dokument `BANK PARAFIA`).
- Wykonać punktową korektę konta po stronie Ma, jeśli użytkownik potwierdzi oczekiwane księgowanie.
- Ważne: to zmiana danych księgowych — wymaga świadomej akceptacji (nie automatyzować bez potwierdzenia).

6. Weryfikacja po wdrożeniu
- Scenariusz E2E:
  1) wejść na `/wyszukaj-konta`,
  2) sprawdzić konto `217-3-3-8` i `110-3-3-1`/`110-3-3-2` dla 2026,
  3) porównać: karta podsumowania, lista operacji, obroty miesięczne, eksport Excel,
  4) potwierdzić zgodność sald i stron Wn/Ma dla pozycji 15.

Pliki objęte zmianami:
- `src/pages/AccountSearch/AccountSearchPage.tsx`
- `src/pages/AccountSearch/TransactionsList.tsx`
- `src/pages/AccountSearch/PrintableAccountTurnover.tsx`
- `src/pages/Documents/TransactionForm.tsx`
- (opcjonalnie, jeśli potwierdzicie korektę danych) migracja SQL z punktową aktualizacją jednej pozycji.
