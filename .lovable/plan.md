# Naprawa: konto syntetyczne 110-2-12 nie pokazuje pełnych obrotów

## Diagnoza (potwierdzona w bazie)

Wyszukiwarka kont (`src/pages/AccountSearch/AccountSearchPage.tsx`) buduje listę powiązanych kont poprawnie – dla 110-2-12 zwraca 8 ID (sam syntetyk + 110-2-12-1 … 110-2-12-5-2). Problem leży w dwóch zapytaniach pobierających transakcje:

1. `account-transactions` (linie ~135–163) – `supabase.from('transactions').select(...).or(orConditions).gte/lte('date',...).order('date').` **Brak paginacji.**
2. `account-opening-balance` (linie ~166–225) – analogicznie, **brak paginacji.**

Supabase/PostgREST ma domyślny limit **1000 wierszy na zapytanie**. Sprawdziłem w bazie: dla 110-2-12 + wszystkich analityk za 2026 r. mamy **1148 transakcji** (sam styczeń: 195, w tym 157 na 110-2-12-2). Wynik zapytania jest obcinany — stąd „brakujące" obroty na koncie syntetycznym w UI i jednocześnie poprawne sumy gdy wybierze się tylko jedną analitykę (każda mieści się w 1000).

To samo tłumaczy, dlaczego raport miesięczny pokazuje dane prawidłowo – `ReportViewFull.tsx` używa już helpera `fetchAllRows` z `src/utils/supabasePagination.ts` (paginowane pobieranie po 1000).

## Plan zmian

Wszystkie zmiany w `src/pages/AccountSearch/AccountSearchPage.tsx`. Nic w bazie ani logice raportów.

### 1. Paginacja zapytania `account-transactions`
- Importować `fetchAllRows` z `@/utils/supabasePagination`.
- Zamiast pojedynczego zapytania użyć `fetchAllRows<Transaction>((from, to) => supabase.from('transactions').select(...).or(orConditions).gte('date', startDate).lte('date', endDate).order('date', { ascending: false }).range(from, to))`.
- Jeżeli `relatedAccountIds.length` jest duże (>~150), `orConditions` może przekroczyć limit długości URL — wtedy dzielić ID na paczki po 150 i scalać wyniki przez `Map<id, tx>` aby zdeduplikować (analogicznie do `fetchTransactionsForAccounts` w `ReportViewFull.tsx`). Dla bieżących danych (max kilkanaście kont) jedna paczka wystarczy, ale dodać guard.

### 2. Paginacja zapytania `account-opening-balance`
- To samo podejście — `fetchAllRows` z filtrem `.lte('date', endOfPrevYear)`.
- Bez tego saldo otwarcia dla syntetyków z długą historią też będzie zaniżone (efekt narastający w kolejnych latach).

### 3. Weryfikacja
- Otworzyć 110-2-12 dla 2026: suma `Obroty Wn` i `Obroty Ma` w widoku miesięcznym musi równać się sumie tych samych kolumn z poszczególnych analityk 110-2-12-1 … 110-2-12-5-2.
- Sprawdzić wybiórczo inną placówkę (np. 110-2-13) – ten sam mechanizm naprawi wszystkie syntetyki, nie tylko Łeby.
- Eksport XLSX/PDF z Wyszukiwarki kont korzysta z tych samych danych – po fixie automatycznie poprawny.

## Czego NIE ruszam
- Raporty miesięczne („Rozliczenia z prowincją" itd.) – tam paginacja już jest, dane są zgodne z wyciągami.
- Schemat bazy, RLS, edge functions.
- Logika filtrowania kont (`useFilteredAccounts`) – konta synthetyczne są dostępne poprawnie.
