# Rozpiska: błędy do naprawy i nowe funkcje do wyceny

## 1. Błędy programu do naprawy (w ramach utrzymania)

### 1.1. Pusta linijka na dokumencie blokuje zapis
- Pole „nowa operacja" na dole dokumentu (jeszcze niezapisane, służy do dodawania kolejnej operacji) jest traktowane jak nieuzupełniony wiersz i blokuje zapis dokumentu.
- Oczekiwane zachowanie:
  - a) Dokument musi się zapisywać nawet z niekompletnymi danymi (puste konta, puste kwoty).
  - b) Na liście dokumentów w kolumnie status ma być widoczna informacja, ile pól jest pustych / brakujących (np. „Brak 3 pól").
  - c) Pusta końcowa linijka „dodaj operację" w ogóle nie ma być wliczana do walidacji — to tylko interfejs wprowadzania.

### 1.2. Eksport raportu miesięcznego do Excel pokazuje stare/błędne salda
- Raport na ekranie (po naprawie sald początkowych) pokazuje już poprawne kwoty.
- Eksport do Excela tego samego raportu nadal generuje stare, błędne salda początkowe.
- Eksport musi 1:1 odpowiadać temu, co widać w raporcie na ekranie.

### 1.3. Import z Excela księguje na kontach syntetycznych mimo istniejącej analityki
- Przy ręcznym wprowadzaniu operacji nie da się wybrać konta syntetycznego, jeśli ma ono analitykę — system wymusza wybór konta analitycznego.
- Przy imporcie rozliczeń z Excela ta walidacja jest pominięta — operacja zapisuje się na koncie syntetycznym (np. 440, 412) bez żadnego ostrzeżenia.
- Decyzja użytkownika:
  - Na podglądzie importu pokazać wizualne ostrzeżenie (czerwone oznaczenie), że konto wymaga analityki.
  - Zapisać operację z pustym polem konta zamiast z syntetyką.
  - Brakujące pole ma być widoczne w statusie dokumentu (powiązane z punktem 1.1).

### 1.4. Edycja operacji z poziomu „konta" zmienia numer i datę dokumentu
- Wejście w konkretne konto → operacja → „Edytuj" przenosi do dokumentu, ale system podmienia numer dokumentu i okres na bieżący miesiąc (np. luty → maj) zamiast zachować oryginalne dane.
- Wejście tą samą operacją z modułu „Dokumenty" działa poprawnie — problem występuje tylko ze ścieżki przez konto.
- Numer i data dokumentu nie mogą być nigdy modyfikowane przy samym otwarciu do edycji.

### 1.5. Konsekwencja sald w Laskowicach (do weryfikacji)
- Salda zobowiązań wobec prowincji w Laskowicach były wcześniej rozjechane, co przeniosło się na kolejne miesiące.
- Obecnie raporty zasysają salda poprawnie, ale ojciec sprawdzi raz jeszcze; jeśli konieczne — punktowa korekta sald historycznych w Laskowicach.

---

## 2. Nowe funkcje do wyceny

### 2.1. Podgląd obrotów i sald bloku kont (zamiennik funkcji z Symfonii) — najważniejsze
Funkcja tylko z poziomu administratora (prowincja).

- Formularz: wybór jednego konta syntetycznego (np. 100, 201, 401, 702) + okres (miesiąc / kwartał / rok).
- Wynik: tabela pokazująca dla wszystkich jednostek prowincji (prowincja → domy → parafie → dzieła OMI):
  - saldo początkowe okresu
  - obroty Winien
  - obroty Ma
  - saldo końcowe
- Grupowanie według poziomu jednostki (1 = prowincja, 2 = domy, 3 = parafie, 4 = dzieła).
- Eksport wyniku do Excela (format do prezentacji, nie wymaga formatu wydruku).
- Cel: szybki przegląd np. gotówki w całej prowincji (konto 100), rozliczeń każdego domu z prowincją (201), wydatków na artykuły biurowe (401) itd.

### 2.2. Materiały marketingowe / cennik demo
- Przygotowanie draftu cennika „bazowego" wersji demo, do prezentacji na czerwcowym forum przełożonych wyższych.
- Ustalenia indywidualne z każdą jurysdykcją, ale potrzebna podstawowa kwota wyjściowa do rozmów.

---

## 3. Status / propozycja kolejności wdrożenia

```text
Priorytet 1 (krytyczne błędy blokujące pracę):
  1.1  pusta linijka blokuje zapis + status z liczbą braków
  1.3  import Excela na konto syntetyczne
  1.2  eksport raportu do Excela ze starymi saldami

Priorytet 2 (poprawki UX):
  1.4  edycja z poziomu konta podmienia numer/datę
  1.5  weryfikacja sald Laskowice

Priorytet 3 (nowa funkcjonalność — osobna wycena):
  2.1  podgląd obrotów i sald bloku kont (panel administratora)
  2.2  draft cennika demo
```
