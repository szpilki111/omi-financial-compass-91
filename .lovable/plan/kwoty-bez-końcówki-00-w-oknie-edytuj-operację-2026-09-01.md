# Kwoty bez końcówki „,00” w oknie „Edytuj operację”

## Problem
W oknie „Edytuj operację” (widok kont) pola „Kwota” Winien/Ma pokazują wartość liczbową bez miejsc dziesiętnych, np. `3772` zamiast `3772,00`. Dzieje się tak, bo pola są zwykłymi polami typu `number` powiązanymi bezpośrednio z liczbą — przeglądarka wyświetla `3772`, a końcówka `,00` znika. Lista operacji i panel „Stan dokumentu” pokazują kwoty poprawnie.

## Co zrobimy
- Pola kwot Winien i Ma w oknie „Edytuj operację” będą zachowywać się tak samo jak w oknie dokumentu:
  - wartość wyświetlana zawsze z dwoma miejscami po przecinku (`3772,00`),
  - podczas wpisywania pole nie „poprawia” użytkownika; formatowanie następuje po opuszczeniu pola,
  - akceptowany zarówno przecinek, jak i kropka (klawiatura numeryczna),
  - puste pole traktowane jako 0.
- Bez zmian w logice zapisu, walidacji bilansu Wn/Ma i blokadach okresów.

## Szczegóły techniczne
- Plik: `src/pages/AccountSearch/EditOperationDialog.tsx`.
- Zamiana dwóch `Input type="number"` na kontrolkę tekstową z `inputMode="decimal"` i lokalnym stanem wyświetlania (wzorzec z `src/components/CurrencyAmountInput.tsx`): normalizacja `,`→`.`, `toFixed(2)` na `blur` i przy zmianie wartości z zewnątrz.
- Wyodrębnimy mały komponent pola kwoty w obrębie tego pliku (lub użyjemy istniejącego `CurrencyAmountInput`, jeśli pasuje bez zmian API), aby oba pola miały identyczne zachowanie.
- Weryfikacja: otwarcie operacji z kwotą całkowitą i z groszami, sprawdzenie zapisu oraz sum w panelu „Stan dokumentu”.

## Czas
Ok. 1 h (poprawka kosmetyczna frontu).
