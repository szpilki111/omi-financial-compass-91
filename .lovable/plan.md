

# Poprawki formatowania Excel - 3 problemy

## Problem 1: Brak funkcji skracania nazw kont

Na Stronie 2 nazwy takie jak "Sprzedaz z dzialalnosci gospodarcz..." sa obcinane przez kolumne bez zadnego oznaczenia. Trzeba dodac funkcje `truncateName()` ktora skraca tekst do okreslonej dlugosci i dodaje kropke na koncu, np. "Sprzedaz z dzialal. gosp." -> czytelne skrocenie.

**Zmiana w ExportToExcelFull.tsx:**
- Dodac helper `truncateName(name, maxLen)` ktory skraca nazwe do maxLen znakow z kropka na koncu
- Zastosowac na Stronie 2: nazwy przychodow do 22 znakow, nazwy rozchodow do 20 znakow
- Na Stronie 1 nazwy sa krotsze (np. "1. Kasa domu") wiec nie potrzebuja skracania

## Problem 2: Brak "zl" przy kwotach

Format `#,##0.00` wyswietla liczby jak `151 366,20` ale bez oznaczenia waluty. Uzytkownik oczekuje `zl` przy kwotach.

**Zmiana:** Zamienic `numFmt: '#,##0.00'` na `numFmt: '#,##0.00 "zł"'` we wszystkich komorkach numerycznych na obu arkuszach (linie 455 i 537).

## Problem 3: Strona 1 - kolumna ucina sie

Na zrzucie ekranu widac ze kolumna E (Koniec miesiaca) jest lekko ucieta. Pierwsza kolumna (A) ma 32 znaki co jest za szerokie - nazwy w niej to np. "1. Kasa domu", "SALDO", "1. Intencje" - maks ~30 znakow wystarczy.

**Zmiana:**
- Zmniejszyc kolumne A z 32 do 28 znakow (wystarczajace dla najdluzszych nazw)
- Zmniejszyc marginesy z 0.3 do 0.2 (lewa/prawa) -- zyskujemy dodatkowa przestrzen
- Dzieki temu kolumny B-E (po 16 znakow) zmieszcza sie na stronie

## Podsumowanie zmian technicznych

| Zmiana | Lokalizacja |
|--------|------------|
| Dodac `truncateName()` helper | ExportToExcelFull.tsx, nowa funkcja |
| Zastosowac truncateName na Stronie 2 | linie 483, 487 |
| Zmienic numFmt na `#,##0.00 "zl"` | linie 455, 537 |
| Zmniejszyc kolumne A z 32 do 28 | linia 417 |
| Zmniejszyc marginesy Strony 1 | linie 420-421 |

