# Globalne podliczanie: dokończenie poprawki + trwały zestaw testowy

## Co zostało ustalone na danych (sprawdzone zapytaniami)

Konto **210-3-7** (Parafia św. Eugeniusza), styczeń 2026 — w bazie są 3 zapisy Wn:
1 800,00 (15.01, dokument zaksięgowany przez parafię) oraz 2 850,00 i 6 100,00 (31.01,
oba dokumenty mają `location_id` = **Prowincja**). Razem **10 750,00** — czyli tyle, ile
pokazują „Obroty miesięczne”.

Stara wersja widoku globalnego przypisywała wiersz do placówki po `location_id` dokumentu,
więc do parafii trafiało tylko 1 800,00, a 8 950,00 „uciekało” do Prowincji — dokładnie to
widać na zrzutach. Po poprawce z poprzedniej zmiany (przypisanie po segmentach numeru konta)
ta sama agregacja liczona na dzisiejszych danych daje **10 750,00**, więc ten konkretny
przypadek jest już naprawiony. Zrzuty pokazują stan przed poprawką.

## Co jeszcze jest realnym źródłem „nieścisłości” (potwierdzone w kodzie/danych)

1. **Placówki poziomu 5 (spółki, identyfikatory 5-1…5-8) nie mają wiersza w tabeli.**
   Grupowanie zna tylko poziomy 1–4 i „inne”, a poziom 5 jest pomijany w tabeli i w eksporcie,
   mimo że wchodzi do sumy RAZEM. Dziś te placówki nie mają jeszcze zapisów, ale w momencie
   pierwszego księgowania suma przestanie się zgadzać z wierszami.
2. **Ten sam błąd „po `location_id`” siedzi jeszcze w innych widokach.** Naprawione zostały
   raport miesięczny (widok) i eksport XLSX, natomiast nadal filtrują po `location_id` dokumentu:
   `ReportAccountsBreakdown`, `YearToDateCashFlowBreakdown`, `YearToDateAccountsBreakdown`,
   oba generatory PDF (`ReportPDFGenerator`, `ReportPDFGeneratorCompact`), `ExportToExcel`
   oraz podsumowanie finansowe pulpitu (`financeUtils`). Skutek jest taki sam jak w zgłoszeniu:
   operacja zaksięgowana przez Prowincję na koncie placówki nie wchodzi do jej danych.
3. **289 kont ma segmenty placówki, które nie odpowiadają żadnej placówce** (identyfikatory
   `3-2`, `3-17`, `3-18`). Dziś są bez zapisów, ale każdy zapis na nich wpadnie do wiersza
   „(nieprzypisane)”.
4. **115 zapisów nie ma żadnego konta Wn/Ma** (osierocone wiersze) — nie psują sum kont,
   ale zaburzają bilans dokumentu.

## Zakres pracy — część 1: dokończenie poprawki

- Uzupełnić grupowanie o poziom 5 (spółki) tak, by żaden wiersz nie ginął, i dodać kontrolę
  „suma wierszy = RAZEM” widoczną w widoku, gdy coś się nie zgadza.
- Ujednolicić dopasowanie placówki po segmentach numeru konta we wszystkich pozostałych
  miejscach z listy powyżej (jedna wspólna funkcja pomocnicza zamiast siedmiu kopii logiki).
- Dodać w widoku globalnym „kontrolę zgodności”: przycisk, który dla wybranego konta i okresu
  porównuje wynik globalny z wynikiem modułu „Wyszukaj konta” i wypisuje różnice — żeby
  rozjazd był wykrywalny od razu, bez zgłoszeń.
- Raport techniczny listy kont nieprzypisanych i zapisów bez kont (do wyczyszczenia danych).

## Zakres pracy — część 2: trwały zestaw testowy

Cel: raz na zawsze zabezpieczyć poprawność obliczeń. Trzy poziomy.

**A. Testy jednostkowe czystej logiki (bez bazy)**
Wydzielenie funkcji liczących (dopasowanie placówki po numerze konta, przeliczenie waluty na PLN,
agregacja obrotów i sald, saldo otwarcia) i pokrycie ich testami z przypadkami krańcowymi:

- konto Prowincji `100-1` a konto domu `100-2-13` (identyfikator „1” nie może łapać „2-13”),
- identyfikator dwuczłonowy `2-10` a konto `…-4-2-10` (brak dopasowania „po kawałku”),
- konto syntetyczne bez segmentów (`210`), konto z analityką 4-poziomową (`110-2-12-3`),
- placówka poziomu 5, konto o segmentach bez placówki → „(nieprzypisane)”,
- zapis z tym samym kontem po Wn i Ma, zapis z jednym kontem puste drugie, zapis bez obu kont,
- kwota Wn ≠ `amount` (zapisy podzielone), wiersz „procent na prowincję”,
- waluta obca z kursem, waluta obca bez kursu, kurs = 0, kwoty ujemne, zaokrąglenia groszowe,
- granice okresu: 1. i ostatni dzień miesiąca, 31.12/1.01 (rok przełomowy), luty roku przestępnego,
- saldo otwarcia: brak poprzedniego miesiąca, saldo przechodzące przez styczeń.

**B. Testy na danych rzeczywistych (kontrola krzyżowa)**
Automatyczny skrypt kontrolny, który dla każdego bloku kont (100, 101, 110, 200, 201, 210, 4xx, 7xx),
każdej placówki i każdego miesiąca roku porównuje trzy źródła: obroty globalne, moduł „Wyszukaj konta”
i raport miesięczny (oraz eksport XLSX). Wynik: lista rozjazdów z kwotą różnicy — pusta lista
oznacza zgodność. To jest narzędzie, którym można sprawdzić cały rok w kilka minut, także po
każdej kolejnej zmianie w programie.

**C. Zestaw kontrolny dla Ojców (dokument)**
Arkusz z gotowymi scenariuszami do wpisania kwot z Symfonii (konto, placówka, miesiąc, saldo
początkowe, Wn, Ma, saldo końcowe) plus instrukcja, jak zgłaszać rozjazd, żeby dał się od razu
odtworzyć. Wypełniony arkusz staje się stałym testem regresji.

## Wycena

| Część | Zakres | Godziny |
| --- | --- | --- |
| 1 | Poziom 5 + kontrola „suma = RAZEM” | 2,5 |
| 1 | Ujednolicenie dopasowania placówki w 7 pozostałych widokach/eksportach/PDF | 6 |
| 1 | Kontrola zgodności w widoku globalnym (przycisk + raport różnic) | 3 |
| 1 | Raport kont nieprzypisanych i zapisów bez kont | 1,5 |
| 2A | Wydzielenie logiki obliczeń + konfiguracja testów | 3 |
| 2A | Testy przypadków krańcowych (ok. 40 przypadków) | 6 |
| 2B | Skrypt kontroli krzyżowej na danych rzeczywistych | 5 |
| 2B | Przejście wyników, poprawki wykrytych rozjazdów | 4 |
| 2C | Dokument zestawu kontrolnego dla Ojców | 2 |
| — | Testy końcowe i poprawki po testach | 3 |

**Razem: 36 h.**
Wariant minimalny (część 1 + 2A, bez kontroli krzyżowej i dokumentu): **20,5 h**.

## Techniczne

- Nowy `src/utils/locationAccountMatching.ts`: `resolveLocationIdentifier(accountNumber, locations)`,
  ścisłe dopasowanie segmentów 2 i 3; użyty w `GlobalAccountTurnovers`, `ReportViewFull`,
  `ExportToExcelFull`, `ExportToExcel`, `ReportAccountsBreakdown`,
  `YearToDate*Breakdown`, oba generatory PDF, `financeUtils`.
- Nowy `src/utils/turnoverEngine.ts`: agregacja obrotów/sald na czystych danych (bez Supabase),
  wspólna dla widoku globalnego i modułu „Wyszukaj konta”.
- Vitest + `src/test/setup.ts` (dziś projekt nie ma konfiguracji testów); testy obok modułów.
- Skrypt kontroli krzyżowej jako strona administracyjna „Kontrola zgodności obliczeń”
  (tylko admin), korzystająca z `turnoverEngine` i tych samych zapytań z `fetchAllRows`
  (paginacja z deterministycznym `order('id')`).
