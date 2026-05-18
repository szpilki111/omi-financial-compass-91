## Plan naprawy rozbijania operacji

### Zasada główna
Przycisk **Rozbij** nie może dzielić kwoty „na pół” ani wymyślać nowych proporcji. Ma działać tylko jako mechanizm **uzupełnienia różnicy dokumentu**.

Jeżeli suma dokumentu jest już zbilansowana:

```text
suma Wn = suma Ma
```

kliknięcie **Rozbij** nie tworzy żadnego nowego wiersza. Pokaże tylko komunikat, że dokument jest zbilansowany i nie ma czego rozbijać.

### Docelowe zachowanie

#### 1. Dokument niezbilansowany
Po kliknięciu **Rozbij** system sprawdzi globalną różnicę całego dokumentu, nie tylko aktualnego wiersza:

```text
różnica = suma Wn - suma Ma
```

- jeśli **Wn < Ma**, brakuje kwoty po stronie Wn,
- jeśli **Ma < Wn**, brakuje kwoty po stronie Ma.

Następnie utworzy jeden nowy wiersz z kwotą dokładnie równą brakującej różnicy po mniejszej stronie.

Przykład:

```text
Wiersz 1: Wn 100 / Ma 50
Suma dokumentu: Wn 100 / Ma 50
Różnica: 50 brakuje po Ma
Klik Rozbij -> nowy wiersz: Wn — / Ma 50
Suma dokumentu: Wn 100 / Ma 100
```

#### 2. Dokument zbilansowany
Jeżeli po pierwszym rozbiciu suma już się zgadza:

```text
Wiersz 1: Wn 100 / Ma 50
Wiersz 2: Wn — / Ma 50
Suma dokumentu: Wn 100 / Ma 100
```

kolejne kliknięcie **Rozbij** na dowolnym wierszu nie zrobi niczego, bo dokument nie ma różnicy do uzupełnienia.

#### 3. Wiersz już częściowy
Dla wierszy typu:

```text
Wn — / Ma 50
```

system nie będzie już sam dzielił 50 na 25 + 25. To było błędne zachowanie. Taki podział użytkownik powinien wykonać ręcznie przez zmianę kwot, która ponownie spowoduje niezbilansowanie dokumentu, a dopiero wtedy **Rozbij** uzupełni brakującą stronę.

Przykład ręcznego dalszego rozbicia:

```text
Start:
Wiersz 1: Wn 100 / Ma 50
Wiersz 2: Wn — / Ma 50
Suma: 100 / 100

Użytkownik zmienia wiersz 2 na Ma 30:
Wiersz 1: Wn 100 / Ma 50
Wiersz 2: Wn — / Ma 30
Suma: 100 / 80

Klik Rozbij -> system doda:
Wiersz 3: Wn — / Ma 20
Suma: 100 / 100
```

### Zmiany techniczne

W pliku `src/pages/Documents/DocumentDialog.tsx` zmienię `handleSplitTransaction` tak, żeby:

1. Najpierw liczył aktualne sumy dokumentu dla właściwej sekcji: głównej albo równoległej.
2. Jeżeli różnica dokumentu wynosi `0,00`, natychmiast przerywał działanie bez dodawania wiersza.
3. Jeżeli dokument jest niezbilansowany, tworzył dokładnie jeden wiersz uzupełniający po mniejszej stronie.
4. Usunął logikę dzielenia istniejącej częściowej kwoty na pół.
5. Nie modyfikował kwoty w klikniętym wierszu — nowy wiersz ma tylko uzupełnić brakującą różnicę.
6. Skopiował opis i typ rozliczenia z klikniętego wiersza, ale konto uzupełnianej strony zostawił puste, żeby użytkownik wskazał właściwe konto.

### Scenariusze kontrolne po wdrożeniu

- `100 / 50` -> **Rozbij** -> dodaje `— / 50`.
- Po tym suma `100 / 100` -> kolejne **Rozbij** nie dodaje niczego.
- `100 / 50 + — / 30` -> **Rozbij** -> dodaje `— / 20`.
- `70 / 100` -> **Rozbij** -> dodaje `30 / —`.
- Przy różnicy poniżej 1 grosza nie dodaje wiersza.
- Zapis nadal jest blokowany, jeśli dokument jest niezbilansowany albo nowy wiersz nie ma konta.