# Naprawa: raport pobiera transakcje obcych placówek (rozjazd salda 201)

## Diagnoza (potwierdzona na danych)

Dla Laskowic (2-10), styczeń 2026:
- **Program (konto 201-2-10)**: Wn 20 000,00 / Ma 6 882,46 / saldo końcowe 17 629,37 ✓
- **Raport (C.3 Rozliczenia z prowincją)**: Należności 22 309,67 / Zobowiązania 7 182,46 / koniec 19 639,04 ✗

Odtworzyłem błędne liczby raportu w SQL co do grosza. Przyczyna:

**Błąd 1 — dopasowanie „kont domu" po wzorcu tekstowym.** Raport pobiera konta placówki wzorcem `LIKE '%-2-10'` oraz `'%-2-10-%'`. Ten wzorzec łapie też konta INNYCH placówek, w których ciąg „2-10" występuje głębiej, np. konta Prokury Misyjnej (4-2): `459-4-2-10`, `217-4-2-10-1-1`. Przez to raport Laskowic zaciągnął transakcje Prokury, których drugą stroną jest `201-4-2-3` — stąd dokładnie +2 309,67 (Wn) i +300,00 (Ma).

**Skala**: problem globalny — np. dla Obry (2-1) wzorzec fałszywie łapie ponad 60 obcych kont (`217-4-2-1-*`, `110-2-2-1`, `100-4-2-1`...). Dotyczy WSZYSTKICH sekcji raportu (przychody 7xx, koszty 4xx, stan finansowy 1xx, należności 2xx, intencje 210) — to tłumaczy też zgłaszane rozjazdy na kontach 1xx i „raz dobrze, raz źle" w różnych domach.

**Błąd 2 — zliczanie obu stron transakcji.** Nawet przy poprawnej liście kont, agregacja dodaje do raportu OBIE strony transakcji, także gdy druga strona to konto innej placówki (np. transakcja mieszana dom↔prowincja). Powinna liczyć tylko stronę należącą do domu.

Saldo początkowe liczone jest tą samą logiką, więc błąd kumuluje się i przenosi na kolejne miesiące — dokładnie jak opisał o. ekonom. Przycisk „Przelicz dane raportu" nie pomagał, bo sekcja C i tak liczy się na żywo z tych samych (błędnych) zapytań.

## Plan naprawy

**Plik: `src/components/reports/ReportViewFull.tsx`** (jedyne miejsce z tą logiką):

1. **Poprawne wyznaczanie kont domu** (zapytanie `report-home-account-ids`): po pobraniu kandydatów wzorcem LIKE dodać ścisły filtr po segmentach — konto należy do placówki tylko gdy `segment2-segment3 === location_identifier` (dla identyfikatorów dwuczłonowych, np. „2-10") albo `segment2 === identifier` (jednoczłonowe, np. Prowincja „1"). Zwracać też numery kont (potrzebne w pkt. 2).

2. **Zliczanie tylko strony domu w agregacji**: w obu pętlach (saldo otwarcia + obroty miesiąca) przed dodaniem kwoty sprawdzić, czy konto danej strony (Wn/Ma) przechodzi ten sam test segmentów. Strona należąca do innej placówki jest pomijana. Dotyczy wszystkich sekcji: 7xx, 4xx, 1xx, 2xx, 210.

3. Bez zmian w mapowaniach (`province` = [201] zostaje), bez zmian w bazie — to czysto frontendowa poprawka logiki liczenia.

## Weryfikacja

- Laskowice styczeń: C.3 musi pokazać 4 511,83 / 20 000,00 / 6 882,46 / 17 629,37 (zgodnie z Wyszukiwarką kont).
- Kontrolnie Obra (2-1, najbardziej dotknięta) i Warszawa — porównanie raportu z obrotami kont.
- Salda przechodzą poprawnie na kolejne miesiące (luty/marzec Laskowic: 17 629,37 → 12 339,37 → 6 795,65).

## Szczegóły techniczne

- Test segmentów: `const p = number.split('-'); p[1] === seg1 && p[2] === seg2` (identyfikator „2-10" → seg1="2", seg2="10"); zapobiega to kolizjom typu `217-4-2-10-1-1`.
- Hook zwróci `Set` numerów/id kont domu, używany zarówno do pobierania transakcji, jak i do filtrowania stron w agregacji.
- Zapytania o transakcje (`fetchTransactionsForAccounts`) bez zmian — po zawężeniu listy kont przestaną pobierać obce transakcje.
