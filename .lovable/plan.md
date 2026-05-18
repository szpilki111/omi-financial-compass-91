# Napraw wielokrotne rozbijanie operacji

## Problem (zreprodukowany)

W `handleSplitTransaction` (`src/pages/Documents/DocumentDialog.tsx`, linie 1447–1579) istnieją dwie gałęzie:

1. **Normalne rozbicie** (oba pola mają kwoty, jedno większe od drugiego) — działa poprawnie: tworzy wiersz uzupełniający z różnicą na mniejszej stronie, druga strona pusta.
2. **`isAlreadySplit`** (jedna strona pusta, druga ma kwotę) — **buguje**: kopiuje kwotę na **przeciwną** stronę nowego wiersza i przepisuje `debit_account_id`/`credit_account_id` ze starego wiersza (które tam są `undefined`).

### Konkretny scenariusz z screenshotu

| Krok | Akcja | Wiersz 1 | Wiersz 2 | Wiersz 3 | Suma Wn/Ma |
|------|-------|----------|----------|----------|------------|
| 1 | Wpis: 100/100 | 100 (A) / 100 (B) | — | — | 100/100 ✅ |
| 2 | User zmienia Ma na 50 | 100 (A) / 50 (B) | — | — | 100/50 ❌ |
| 3 | Klik "Rozbij" w 1 | 100 (A) / 50 (B) | — / 50 (B) | — | 100/100 ✅ |
| 4 | Klik "Rozbij" w 2 | 100 (A) / 50 (B) | — / 50 (B) | **50 (—) / —** | **150/100** ❌ |

Krok 4 to bug: zamiast **dalej podzielić** stronę Ma wiersza 2 (np. 30+20 na różne konta Ma), kod skopiował 50 na stronę Wn nowego wiersza, łamiąc bilans i mieszając konta.

## Rozwiązanie

Rozdzielić intencje:

### A. Przycisk "Rozbij" na wierszu częściowo wypełnionym (jedna strona pusta z `_account_id=undefined`)

Oznacza: **subdividuj kwotę na tej samej stronie**. Nowy wiersz musi mieć kwotę na **tej samej** stronie co źródło, kwota = `0` (do uzupełnienia przez usera), konto puste, druga strona pusta.

Dodatkowo: walidacja przy zapisie (już istnieje `incompleteRowsCount`) wymusi uzupełnienie kwoty i konta. Bilans dokumentu (`isDocumentBalanced`) blokuje zapis dopóki suma podziałów nie zgadza się z resztą operacji.

**Edge case**: jeśli wiersz częściowy ma kwotę X i user chce ją podzielić, sensowniej jest od razu zmniejszyć źródłową kwotę o połowę i dać drugą połowę nowemu wierszowi (zachowanie bilansu od ręki). Wybieram tę wersję — żaden wiersz nie zostaje z 0, bilans dokumentu utrzymany.

### B. Przycisk "Rozbij" na wierszu zbilansowanym (oba pola mają równe kwoty)

Obecnie zwraca toast "Kwoty są równe, nie ma czego rozdzielać" — to też utrudnia użycie. Najczęściej user chce wtedy rozbić **stronę Ma** (lub Wn) na kilka kont. 

Zachowanie: zamiast błędu, otworzyć istniejący `TransactionSplitDialog` (już zaimplementowany w `src/pages/Documents/TransactionSplitDialog.tsx`, ale obecnie **nie podpięty nigdzie**), który pozwala zdefiniować N pozycji sumujących się do kwoty docelowej. Na submit zastępujemy źródłowy wiersz N wierszami.

W pierwszej iteracji wybór strony do rozbicia: domyślnie **Ma** (najczęstszy przypadek księgowy — jeden wpływ/wydatek rozdzielony na kilka kategorii kosztów/przychodów). User może później wybrać przyciskiem strony.

### C. Normalne rozbicie (różne kwoty) — bez zmian

Działa poprawnie, zostawiamy.

## Zakres zmian

**Pliki:**
- `src/pages/Documents/DocumentDialog.tsx` — przepisanie gałęzi `isAlreadySplit` w `handleSplitTransaction` (linie 1476–1520) tak, żeby:
  - kwota nowego wiersza była na **tej samej** stronie co źródło,
  - kwota = połowa źródłowej, źródłowa też zmniejszona o połowę (zaokrąglenie do grosza, reszta zostaje na pierwszym wierszu),
  - druga strona nowego wiersza pusta (`undefined` amount, `undefined` account_id),
  - konto na rozbijanej stronie puste w nowym wierszu (user wybiera nowe konto).

- (Opcjonalnie, etap 2) podpiąć `TransactionSplitDialog` dla wierszy zbilansowanych — wymaga przycisku wyboru strony i obsługi `onSplit` zastępującej źródłowy wiersz tablicą N nowych wierszy z aktualizacją `display_order`.

## Test po wdrożeniu

Odtworzyć w przeglądarce scenariusz z screenshotu (100/100 → zmiana Ma na 50 → split → split na wierszu 2) i potwierdzić:
- wiersz 3 powstaje z kwotą po stronie Ma (nie Wn),
- suma Wn/Ma dokumentu pozostaje 100/100,
- alert walidacyjny w stopce nie pokazuje "Różnica",
- przycisk Zapisz blokowany dopiero gdy konta są puste (nie z powodu bilansu).

Także scenariusz potrójnego rozbicia po stronie Ma: 100/100 → split → split → split, oczekiwane 4 wiersze, suma 100/100, wszystkie kwoty na Ma sumują się do 100.
