## 1. Błędne przenoszenie sald od marca (Siedlce 110-2-16-1)

### Co ustalono na danych (sprawdzone zapytaniami)

Dane w bazie są poprawne i identyczne dla obu widoków — wszystkie zapisy na `110-2-16-1` do 28.02.2026 należą do jednej placówki (2-16, Siedlce), w PLN:

```text
BO 31.12.2025    Wn 202 589,60
styczeń 2026     Wn  93 121,22   Ma 64 592,79
luty 2026        Wn  86 571,80   Ma 29 438,47
--------------------------------------------
saldo na 1.03.2026 = 288 251,36  (wartość z modułu Wyszukaj konta i z Symfonii)
```

Widok globalny pokazuje **195 130,14**, czyli dokładnie 288 251,36 − 93 121,22 → z salda początkowego **wypadły styczniowe obroty Wn**. Obroty bieżącego miesiąca (58 158,54 / 43 856,84) zgadzają się, więc błąd dotyczy wyłącznie zapytania o okres poprzedni.

### Przyczyna

`GlobalAccountTurnovers.tsx` pobiera transakcje stronami po 1000 wierszy (`fetchAllRows`) z sortowaniem `order('date')`. Dla prefiksu 110 samych zapisów po stronie Wn do końca lutego jest 2830 — czyli 3 strony. Ponieważ `date` nie jest unikalne, PostgreSQL nie gwarantuje stabilnej kolejności między kolejnymi zapytaniami: część wierszy z granicy strony powtarza się, a część nie zostaje pobrana wcale (dedupe po `id` dodatkowo maskuje duplikaty). Stąd „gubione” obroty przy większych kontach i przy dłuższej historii — dlatego styczeń i luty jeszcze się zgadzały, a od marca (gdy okres poprzedni przekroczył 1000+ wierszy na stronę) już nie.

### Naprawa

1. `src/utils/supabasePagination.ts` — brak zmiany logiki, ale dokumentacja wymogu stabilnego sortowania.
2. Dodać deterministyczny tie-breaker `.order('id', { ascending: true })` po `.order('date')` we wszystkich paginowanych zapytaniach o transakcje:
  - `src/pages/Administration/GlobalAccountTurnovers.tsx` (`fetchSideTx` — okres poprzedni i bieżący),
  - `src/pages/AccountSearch/AccountSearchPage.tsx` (`account-transactions` oraz `account-opening-balance` — to drugie dziś nie ma żadnego `order`, więc jest równie niestabilne),
  - `src/components/reports/ReportViewFull.tsx` (`fetchTransactionsForAccounts`),
  - `src/components/reports/ExportToExcelFull.tsx` (te same zapytania w eksporcie),
  - pozostałe miejsca z `fetchAllRows` na tabeli `transactions` znalezione przez `rg` (np. `DocumentsPage.tsx`) — dla spójności.
3. Weryfikacja: uruchomić widok globalny dla konta 110, marzec 2026 i porównać saldo początkowe 110-2-16-1 z 288 251,36 oraz saldo końcowe z 302 553,06 (wartości z modułu Wyszukaj konta / Symfonii). Sprawdzić dodatkowo jeszcze jedno konto z dużą liczbą analityk (np. 201) na kwietniu/maju.

Uwaga: to naprawia wszystkie placówki naraz — błąd nie był specyficzny dla Siedlec, tylko dla kont z dużą liczbą zapisów.

## 2. Waluty w rozbiciu miesięcznym (Wyszukaj konta)

Cel: pod każdą kwotą PLN w tabeli „Obroty miesięczne” dodać w nawiasie kwotę w walucie obcej — tak jak dziś działa pasek podsumowania na górze.

1. `src/pages/AccountSearch/AccountSearchPage.tsx` — rozszerzyć `monthlyData`: dla każdego miesiąca policzyć obok `debit`/`credit` (PLN) także `debitByCurrency` / `creditByCurrency` (Map waluta → kwota w walucie oryginalnej), używając tej samej logiki wyboru waluty co `currencyTotals` (priorytet waluty dokumentu, potem transakcji). Przekazać do `MonthlyTurnoverView` również `openingCurrencyBalances` z `openingBalanceData.currencyBalances`.
2. `src/pages/AccountSearch/MonthlyTurnoverView.tsx`:
  - liczyć narastające saldo walutowe analogicznie do PLN (saldo otwarcia roku w walucie + Wn − Ma po miesiącach, per waluta),
  - w komórkach Saldo początkowe / Obroty Wn / Obroty Ma / Saldo końcowe oraz w wierszu RAZEM renderować drugą linijkę: `(12 203,84 EUR)` — mniejszą czcionką, w kolorze `text-muted-foreground`,
  - nawias pokazywać tylko gdy dana waluta ma niezerową wartość; przy kilku walutach — po jednej linijce na walutę,
  - konta bez zapisów walutowych wyglądają dokładnie jak dziś (brak dodatkowej linii).
3. Formatowanie liczb wg polskiej konwencji (spacja jako separator tysięcy, przecinek dziesiętny), symbol waluty jako kod (EUR/USD).

## Szczegóły techniczne

- Zmiany wyłącznie po stronie frontendu; brak migracji bazy.
- Wydruk `PrintableAccountTurnover` i eksport XLSX z Wyszukaj konta pozostają bez zmian (chyba że zażyczysz sobie tam też nawiasów walutowych).

&nbsp;

Od użytkownika: ale nawiasy z walutą pokazuj tylko i wyłącznie dla kwot przeliczanych z walut oczywiście, a nie dla wszystkich w całym systemie. tylko dla tych, które są przeliczane i pokazuje w złotówkach po przliczeniu, ale dla kwot, które nie są przeliczane, tylko były wprowadzone jako złotówki, to nie pokazuj nawiasów ofc. upraszczając możesz założyć, że nawiasy tylko tam, gdzie jest dodatkowy pasek z walutą, tak jak na screencie.