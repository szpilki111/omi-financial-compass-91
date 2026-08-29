# Walidacja całego dokumentu przy edycji jednej operacji

Tak, da się to zrobić bez dużych komplikacji — i warto, bo dziś edycja pojedynczego wiersza sprawdza tylko ten wiersz (opis, bilans Wn/Ma, kurs, blokada okresu), a status dokumentu na liście (`validation_errors`) pozostaje z poprzedniego zapisu i może być nieaktualny.

## Co zostanie zrobione

1. **Wspólny walidator dokumentu**
   Wyciągnięcie zasad, które dziś działają wewnątrz okna dokumentu, do jednej funkcji używanej w obu miejscach:
   - niekompletne operacje (brak kwoty Wn/Ma, brak konta Wn/Ma),
   - brak konta na wierszach (typ „missing_accounts”),
   - niezbilansowanie dokumentu (suma Wn ≠ suma Ma, tolerancja 0,01),
   - brak jakichkolwiek operacji,
   - wiersze „procent na prowincję” bez wiersza nadrzędnego (osierocone).

2. **Sprawdzanie całego dokumentu w oknie „Edytuj operację”**
   - Po otwarciu dialogu doczytywane są wszystkie operacje danego dokumentu i pod formularzem pojawia się panel „Stan dokumentu”: suma Wn, suma Ma, różnica oraz lista wykrytych problemów (z numerem Lp. wiersza).
   - Panel jest informacyjny: pokazuje, czy problem dotyczy edytowanego wiersza, czy innych operacji dokumentu.

3. **Ponowna walidacja po zapisie**
   - Po udanym zapisie wiersza walidator jest uruchamiany na świeżo pobranych operacjach dokumentu, a wynik zapisywany do `documents.validation_errors` (lub czyszczony, gdy wszystko jest poprawne).
   - Dzięki temu badge na liście dokumentów („X pustych pól”, „niezbilansowany”) od razu odzwierciedla rzeczywistość.
   - Toast po zapisie informuje: „Operacja zapisana — dokument poprawny” albo „Operacja zapisana, dokument nadal ma X problemów”.

4. **Zachowane zasady bezpieczeństwa**
   - Zapis nadal jest blokowany tylko przez: zamknięty okres (raport wysłany/zatwierdzony), wiersz „procent na prowincję”, oraz błędy w samym edytowanym wierszu.
   - Problemy w innych wierszach nie blokują zapisu (tak jak w oknie dokumentu) — są tylko raportowane, z podpowiedzią „otwórz dokument”, żeby je poprawić.

## Szczegóły techniczne

- Nowy plik `src/utils/documentValidation.ts` — czysta funkcja `validateDocumentTransactions(transactions)` zwracająca `{ errors, totalDebit, totalCredit }`, w formacie zgodnym z obecnym `validation_errors`.
- `src/pages/Documents/DocumentDialog.tsx` — podmiana wewnętrznej logiki walidacji na wywołanie wspólnej funkcji (bez zmiany zachowania i komunikatów).
- `src/pages/AccountSearch/EditOperationDialog.tsx` — dodatkowe zapytanie o wszystkie transakcje `document_id`, panel „Stan dokumentu”, ponowna walidacja i update `validation_errors` po zapisie.
- Testy Vitest dla `documentValidation` (zbilansowany, niezbilansowany, braki kont/kwot, osierocony wiersz prowincji).

## Wycena

- Wspólny walidator + refaktor okna dokumentu: 3 h
- Panel „Stan dokumentu” i doczytanie operacji w dialogu edycji: 2 h
- Ponowna walidacja i aktualizacja `validation_errors` po zapisie: 1,5 h
- Testy + przejście ręczne (dokument zbilansowany/niezbilansowany, zamknięty okres, wiersz prowincji): 1,5 h

**Razem: 8 h**
