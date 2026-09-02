# Import formularza Excel: ręczny wybór analityki zamiast blokady

## Problem
Formularz z placówki podaje konto syntetyczne (np. `453-1`), a w programie istnieje kilka analityk (`453-1-1`, `453-1-2`, `453-1-3`...). Dialog importu nie potrafi wybrać jednej z nich, oznacza wiersz jako błędny i całkowicie blokuje przycisk importu (przycisk pokazuje „Brakujące konta”). Efekt: całego formularza nie da się wciągnąć do programu, mimo że 6 z 7 pozycji jest poprawnych.

## Rozwiązanie
Zamiast blokować import — pozwolić użytkownikowi wskazać właściwą analitykę bezpośrednio w oknie podglądu, a jeśli nie chce, zaimportować dokument z pustym kontem do uzupełnienia później.

### 1. Wybór konta w wierszu podglądu
- W kolumnach „Wn” i „Ma” tabeli podglądu: gdy konto jest niejednoznaczne lub puste, zamiast czerwonego tekstu pokazać wyszukiwalny selektor kont (ten sam komponent co w dokumentach, `AccountCombobox`), zawężony domyślnie do listy analityk pasujących do prefiksu z formularza.
- Po wyborze wiersz od razu przestaje być czerwony, status zmienia się na ✓, a liczniki „X poprawnych / Y z błędami” aktualizują się na żywo.
- Wybrane konto pamiętane jest per wiersz w stanie dialogu (nadpisuje wynik automatycznego dopasowania).

### 2. Masowe zastosowanie wyboru
- Jeśli ten sam niejednoznaczny prefiks (np. `453-1`) występuje w kilku wierszach, po pierwszym wyborze pokazać opcję „Zastosuj do wszystkich pozycji z kontem 453-1”.

### 3. Odblokowanie importu
- Przycisk importu przestaje być zablokowany przy niejednoznacznych kontach. Zostaje aktywny i podpisany „Importuj N operacji”.
- Gdy zostały jeszcze puste konta, przycisk otrzymuje wariant ostrzegawczy i podpis „Importuj mimo braków (N)”, a przed zapisem pojawia się krótkie potwierdzenie z listą pozycji bez konta.
- Puste konta zapisują się jako `null` (mechanizm już istnieje) — dokument trafia na listę ze statusem niekompletnego i można go dokończyć w oknie dokumentu.
- Twarda blokada zostaje tylko wtedy, gdy konto w ogóle nie istnieje w programie i nie ma żadnej analityki — wtedy nadal komunikat „Nie znaleziono konta ...” z podpowiedzią dodania w Administracja → Konta.

### 4. Komunikaty
- Tekst błędu dla niejednoznacznej syntetyki zmienia się z komunikatu blokującego na podpowiedź: „Wskaż analitykę dla konta 453-1”.
- Alert nad tabelą rozdziela dwa przypadki: „konta do wskazania” (żółty, nie blokuje) i „konta nieistniejące” (czerwony).

## Szczegóły techniczne
- Plik: `src/pages/Documents/ExcelFormImportDialog.tsx`.
- Nowy stan `manualAccountOverrides: Record<string, string>` (klucz: indeks wiersza + strona Wn/Ma).
- `findAccount` zwraca dodatkowo powód (`ambiguous` | `missing`) zamiast samego `undefined`; `hasAccountErrors` rozbite na `hasAmbiguousAccounts` i `hasMissingAccounts`.
- Przycisk importu blokowany wyłącznie przez `hasMissingAccounts`.
- Selektor kont: istniejący `AccountCombobox` z `src/pages/Documents/AccountCombobox.tsx` (ma już mini wyszukiwarkę i fokus).
- Bez zmian w bazie danych i bez zmian w logice generowania opłaty prowincjalnej.

## Nakład
Około 3–4 h.
