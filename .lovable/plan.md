## Problem 1 — dokument nie waliduje bilansu Wn=Ma ani brakujących kont (wideo)

Z nagrania widać, że w dialogu dokumentu można:
- mieć wiersz z kwotą Wn ≠ Ma (np. 55,00 vs 55 655,00),
- pozostawić konto jako „Wybierz" (puste),
- po użyciu „Rozdziel kwotę" powstaje pusty wiersz z `0,00 / Wybierz`,
- mimo że łączne RAZEM Wn (72 369,28) ≠ Ma (127 869,28), nic nie sygnalizuje błędu — stopka pokazuje tylko sumy, brak czerwonego alertu, a „Zapisz zmiany" jest aktywne.

To regresja — wcześniej taka walidacja istniała.

### Zakres naprawy (frontend: `src/pages/Documents/DocumentDialog.tsx` + ew. `InlineTransactionRow.tsx`, `TransactionSplitDialog.tsx`)

1. **Walidacja bilansu na poziomie dokumentu** (po stronie zapisu i jako stały wskaźnik w stopce):
   - Liczyć `sumWn` i `sumMa` na podstawie aktualnych wierszy (z uwzględnieniem waluty/kursu — tak jak liczone są RAZEM).
   - Jeśli `|sumWn − sumMa| > 0,005` → w stopce wyświetlić czerwoną informację „Dokument niezbilansowany: różnica X,XX zł" oraz zablokować przycisk „Zapisz zmiany" (disabled + tooltip z powodem).
   - Dodatkowy guard w `onSubmit`: nawet jeśli ktoś ominie UI, blokować zapis i pokazywać toast błędu.

2. **Walidacja kompletności wierszy**:
   - Wiersz jest „pusty/szkic" gdy: kwota Wn=0 i Ma=0 i oba konta = `Wybierz` → przy zapisie pomijać go (po uprzednim potwierdzeniu) albo usuwać.
   - Wiersz „niekompletny" gdy: kwota > 0 a brak konta po tej stronie, lub konto wybrane a kwota = 0 → czerwony border + komunikat „Wybierz konto / Podaj kwotę". Blokować zapis.
   - Wiersz „niezbilansowany per‑row" (Wn ≠ Ma w tym samym wierszu) jest dozwolony tylko jeśli istnieje wiersz uzupełniający (split). Inaczej oznaczać go ostrzeżeniem żółtym i wliczać do walidacji sum dokumentu.

3. **Naprawa „Rozdziel kwotę"** (`TransactionSplitDialog.tsx`):
   - Po splicie nowo utworzony wiersz powinien dziedziczyć drugą stronę bilansu z wiersza źródłowego (lub być oznaczony jako wymagający uzupełnienia konta), a nie powstawać jako `0,00 / Wybierz`.
   - Po splicie nie zwalniać aktualizacji RAZEM — sprawdzić, czy stan jest poprawnie odświeżany (memo/refetch).

4. **Aktualizacja stopki RAZEM w czasie rzeczywistym**:
   - W filmie po dodaniu wiersza RAZEM przez chwilę nie aktualizuje się. Upewnić się, że suma jest liczona z bieżącego stanu (lokalnego), a nie z DB.

5. **Toast/alert blokujący**:
   - Przy próbie zapisu z błędami: jeden zbiorczy modal/alert „Nie można zapisać: niezbilansowany dokument / niekompletne wiersze" z listą problemów (numery wierszy).

---

## Problem 2 — „Rozliczenia z prowincją" (sekcja C) w raporcie ≠ saldo konta 201‑2‑10 w „programie"

Przykład: Laskowice, styczeń. W AccountSearch dla 201‑2‑10 saldo = **17 659,37** (zawiera „świadczenia parafii na prowincję 1 160,00" i „fundacja św. Józefa 600,00"). W raporcie sekcja C, wiersz 3 „Rozliczenia z prowincją" = **19 419,37**. Różnica 1 760,00 = 1 160 + 600.

### Diagnoza (kod: `src/components/reports/ReportViewFull.tsx` + warianty PDF/Excel)

- Domyślny mapping `DEFAULT_LIABILITY_CATEGORIES` używa prefiksu `'201'` (jednoczłonowego). W konsekwencji `getCategoryOpeningBalance` i agregacja używają gałęzi „single‑segment → sumuj wszystko co zaczyna się od `201`" — czyli włącznie z `201‑2‑11`, `201‑2‑12` itd. (subkonta świadczeń parafii i fundacji), które wpadają do tej samej kategorii zamiast być wyłączone.
- Z opisu wynika, że „świadczenia parafii na prowincję" i „fundacja św. Józefa" księgowane są na osobnych subkontach 201‑*, ale w raporcie traktowane są jak „rozliczenie z prowincją". AccountSearch pokazuje tylko 201‑2‑10, więc nie zawiera tych dwóch pozycji — stąd rozbieżność.
- Wniosek: kategoria C.3 nie powinna sumować całego prefiksu `201`, lecz tylko konkretne subkonta odpowiadające „czystym" rozliczeniom z prowincją. Mechanizm konfiguracji już istnieje (`report_liability_category_mappings`), ale w bazie nie ma odpowiednich wpisów per‑placówka.

### Zakres naprawy

A. **Logika spójności (frontend, `ReportViewFull.tsx`, `ReportPDFGeneratorCompact.tsx`, `ExportToExcelFull.tsx`):**
   - Spójnie traktować mapping — jeżeli istnieje mapping dla kategorii (globalny lub per‑lokalizacja), używać go w obu miejscach (saldo otwarcia + ruchy bieżące + PDF/Excel). Obecnie ReportViewFull już to robi, ale upewnić się, że identyczna logika jest w PDF i Excel (regresja możliwa w PDF/Excel — tam są zaszyte stałe prefiksy `201`/`217`).
   - Dodać dziennikowanie (`console.log`) listy kont, które złożyły się na każdą kategorię — ułatwi audyt.

B. **UI do konfiguracji mapping per placówka** (Administracja):
   - Strona „Mapowanie kategorii raportu" (lub rozszerzenie istniejącej `LiabilityCategoryMappings.tsx` — sprawdzić, czy taka istnieje pod ścieżką Administracja → Mapowanie zobowiązań). Tabela: `category_key` × placówka × lista prefiksów / pełnych numerów kont.
   - Walidacja: dla `province` (Rozliczenia z prowincją) wymagać konkretnych subkont (np. `201‑2‑10`), nie samego `201`.
   - Podgląd „co wpadnie do kategorii" na żywo (lista kont z bazy pasujących do prefiksów).

C. **Migracja danych — naprawienie aktualnego mappingu dla Laskowic**:
   - Dodać per‑location wpis dla `category_key = 'province'` z prefiksem `201‑2‑10` (i analogiczne wpisy dla pozostałych placówek po konsultacji).
   - Dla pozostałych kategorii (`loans_given`, `loans_taken`, `others`) zweryfikować, że globalny mapping pozostaje poprawny.
   - Wykonać jako migrację/skrypt insertujący tylko tam, gdzie wpisu jeszcze nie ma (idempotentnie).

D. **Re‑kalkulacja istniejących raportów**:
   - Po naprawie dodać przycisk „Przelicz ponownie" już istnieje — upewnić się, że unieważnia cache (queryKey z wersją) i ponownie liczy sekcję C wg nowego mappingu. Wystarczy bump queryKey (`report-full-data-v3`).

E. **Test akceptacyjny**:
   - Laskowice / styczeń 2026 → C.3 = 17 659,37 (zgodne z AccountSearch 201‑2‑10).
   - PDF i Excel pokazują tę samą wartość.

---

## Pliki do zmiany (szacunkowo)

- `src/pages/Documents/DocumentDialog.tsx` — walidacja bilansu, blokada zapisu, alert w stopce.
- `src/pages/Documents/InlineTransactionRow.tsx` — walidacja wiersza (border/tooltip).
- `src/pages/Documents/TransactionSplitDialog.tsx` — poprawny stan po splicie.
- `src/components/reports/ReportViewFull.tsx` — bump queryKey, drobne logi.
- `src/components/reports/ReportPDFGeneratorCompact.tsx`, `src/components/reports/ExportToExcelFull.tsx` — używać tego samego mechanizmu mappingu co ReportViewFull.
- `src/pages/Administration/LiabilityCategoryMappings.tsx` (lub utworzyć) — UI konfiguracji per placówka.
- Migracja SQL — wstawienie per‑location mappingu `province → ['201-2-10']` dla Laskowic (po potwierdzeniu listy placówek/subkont).

## Kolejność wdrożenia
1. Problem 1 — walidacja dokumentu (krytyczne dla danych księgowych).
2. Problem 2A — wyrównanie logiki PDF/Excel z UI.
3. Problem 2B — UI mappingu w Administracji.
4. Problem 2C — migracja danych dla Laskowic (i kolejnych placówek wskazanych przez użytkownika).
5. Problem 2D/E — re‑kalkulacja i weryfikacja.

## Pytania przed wdrożeniem
- **Dla każdej placówki potrzebuję listy „czystych" subkont 201 do prowincji** — czy zawsze jest to wzorzec `201‑X‑10`, czy zróżnicowane? Jeżeli tak, mogę użyć konwencji nazewniczej i wypełnić mapping automatycznie.
- Czy świadczenia parafii (1 160) i fundacja (600) powinny pojawiać się w innym wierszu sekcji C (np. nowa pozycja „Świadczenia na rzecz prowincji") czy pomijane całkowicie?
- Czy w przypadku niezbilansowanego dokumentu chcesz całkowitą blokadę zapisu, czy możliwość zapisu jako „szkic" z czerwonym oznaczeniem (analogicznie do walidacji raportów)?
