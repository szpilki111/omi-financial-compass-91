

## Diagnoza i plan naprawy 5 zgłoszonych problemów

### 1. Rozbijanie kwoty tworzy wiersz z 0.00 gdy nie ma czego rozbijać

**Problem**: W `handleSplitTransaction` (DocumentDialog.tsx linia 1244-1298), gdy kwoty Wn/Ma są już zbalansowane (`balanceAmount === 0`), system poprawnie blokuje (linia 1255). Ale w gałęzi "already split" (linia 1244), jeśli `totalDebit === totalCredit`, informuje o wyrównaniu. Natomiast problem polega na tym, że po kliknięciu przycisku split na wierszu, który jest wynikiem wcześniejszego rozbicia (ma np. 0.00 po jednej stronie i kwotę po drugiej), system sprawdza globalne sumy i może wygenerować wiersz z `balanceAmount > 0` mimo, że **ten konkretny wiersz** ma już kwotę 0 po stronie wypełnianej.

**Rozwiązanie**: Przed tworzeniem nowego wiersza z rozbicia, sprawdzić czy `balanceAmount` (różnica globalnych sum Wn/Ma) wynosi 0. Jeśli tak — nie tworzyć nowego wiersza. Dodatkowo, ukryć przycisk rozbicia (ikonę nożyczek) na wierszach, gdzie obie kwoty wynoszą 0 (linia ~1232 już to robi, ale sprawdzić czy dotyczy też wierszy z `undefined`).

**Plik**: `src/pages/Documents/DocumentDialog.tsx`
- W `handleSplitTransaction`, gałąź `isAlreadySplit` (linia 1244): dodać guard na `balanceAmount === 0` wcześniej (jest na linii 1255, ale upewnić się, że obejmuje też `< 0.01`).
- Na poziomie renderowania `SortableTransactionRow`: ukryć przycisk split gdy obie kwoty wiersza wynoszą 0 lub undefined.

---

### 2a. "Przy exporcie pliku dodaje pozycje" (z innego miesiąca)

**Problem**: Zgłoszenie mówi o exporcie dokumentu do Excel, który dodaje pozycje z lutego mimo wybranego zakresu stycznia. Funkcja `handleExportToExcel` (linia 174) eksportuje `[...transactions, ...parallelTransactions]` z UI state — czyli to co widać w dialogu. Nie filtruje po dacie, bo eksportuje cały dokument. Problem prawdopodobnie polega na tym, że transakcje MT940 mają indywidualne daty (`transaction.date`) z pliku bankowego, które mogą wykraczać poza miesiąc dokumentu.

Ale zgłoszenie mówi "choć jest wybrany zakres miesiąca stycznia" — to sugeruje, że chodzi o **raport** (ExportToExcel w reports), nie o dokument. Raport filtruje transakcje po `transactions.date`. Jeśli dokument ma datę stycznia ale import MT940 zapisał datę transakcji z lutego (`date: transaction.date` — linia 525 Mt940ImportDialog), to te transakcje trafią do raportu za luty, nie za styczeń.

**Rozwiązanie**: W `Mt940ImportDialog.tsx` (linia 525), zmienić `date: transaction.date` na `date: documentDate.toISOString().split('T')[0]` — tak aby wszystkie transakcje z importu miały datę dokumentu, nie indywidualną datę z pliku bankowego. Alternatywnie, zachować oryginalna datę transakcji ale dodać osobne pole `document_date` do filtrowania. Najprostsze i najbardziej spójne z resztą systemu (DocumentDialog używa `format(data.document_date, 'yyyy-MM-dd')` dla wszystkich transakcji) jest użycie daty dokumentu.

**Plik**: `src/pages/Documents/Mt940ImportDialog.tsx` — linia 525

---

### 2b. "Błąd przewalutowania"

**Problem**: Zgłoszenie: "W podsumowaniu w górnym wierszu podawane są kwoty waluty, a powinno być w złotówkach. W dolnym wierszu jest waluta pomniejszona o kurs z górnego wiersza."

Patrząc na podsumowanie dokumentu (linie 1956-1991):
- Górny wiersz: `totalDebitSum * displayMultiplier` — gdy `showInPLN=false`, displayMultiplier=1, więc wyświetla kwotę w walucie oryginalnej. To jest poprawne.
- Dolny wiersz (linia 1979-1989): "Równowartość w PLN" — wyświetla `totalDebitSumPLN = totalDebitSum * plnMultiplier` gdzie `plnMultiplier = exchangeRate`. To jest poprawne.

Ale problem jest **gdy `showInPLN=true`**: górny wiersz pokazuje `totalDebitSum * exchangeRate` (przeliczone na PLN), a dolny nadal pokazuje `totalDebitSumPLN` (też przeliczone). Ale `isForeignCurrency` warunkuje wyświetlenie dolnego wiersza. Kiedy `showInPLN=true`, górny wiersz jest w PLN a dolny nadal się wyświetla z tymi samymi kwotami — co jest bez sensu.

Prawdziwy problem: etykiety i logika sekcji nie uwzględniają stanu `showInPLN`. Gdy toggle jest włączony:
- Górny wiersz powinien pokazywać kwoty w PLN (labelka "w PLN")
- Dolny wiersz powinien się ukryć (bo górny już jest w PLN)

Ale gdy `showInPLN=false`:
- Górny wiersz: kwoty w walucie oryginalnej
- Dolny wiersz: równowartość w PLN

**Rozwiązanie**: Ukryć dolny wiersz ("Równowartość w PLN") gdy `showInPLN=true`. Dodać informację o walucie w labelce górnego wiersza.

**Plik**: `src/pages/Documents/DocumentDialog.tsx` — linie 1979-1990: zmienić warunek `isForeignCurrency` na `isForeignCurrency && !showInPLN`.

---

### 2c. "Zmiana numeru dokumentu" (import MT940)

**Problem**: "Kiedy zasysa się wyciąg z poprzedniego miesiąca pobrany w miesiącu następnym (wyciąg z lutego pobrany w marcu), system nadaje numer dokumentu z miesiąca pobranego. Mimo zmiany daty numer dokumentu nie zmienia się."

Import MT940 generuje numer na podstawie `documentDate` (linia 490-495), nie na podstawie dat transakcji w pliku. Ale po imporcie, gdy użytkownik edytuje dokument i zmienia datę — regeneracja powinna działać (linie 626-648).

Problem: regeneracja sprawdza `originalDocumentDate.current` (ustawiane z `document.document_date` w liniach 568-573). Ale to porównanie działa poprawnie. Podejrzenie: `document.location_id` może być `undefined` jeśli nie jest ładowane z relacją. Sprawdzić czy `document` prop zawiera `location_id`.

Drugie podejrzenie: MT940 dialog generuje numer z `documentDate.getMonth() + 1` — co jest miesiącem **wybranym przez usera w dialogu importu**, nie miesiącem transakcji. Ale error report mówi, że numer jest z miesiąca pobranego (marca), nie z miesiąca wyciągu (lutego). To znaczy, że user nie zmienił `documentDate` w dialogu importu przed importem, i potem próbuje zmienić datę w DocumentDialog.

Problem jest prawdopodobnie w tym, że po otwarciu edytowanego dokumentu z MT940, `originalDocumentDate.current` jest ustawiane na datę z dokumentu (marzec). Gdy user zmienia datę na luty — nowy miesiąc różni się od oryginalnego, więc regeneracja powinna się odpalić. Ale być może `document.location_id` nie jest przekazywane?

Sprawdzę skąd pochodzi `document` prop:

**Plik do sprawdzenia**: `src/pages/Documents/DocumentsPage.tsx` lub `DocumentsTable.tsx` — jak jest przekazywany `document` prop do `DocumentDialog`.

To wymaga dodatkowej weryfikacji — dodam to do planu jako punkt do sprawdzenia.

---

### 2d. "Niezapisywanie danych" (utrata dokumentu po przejściu na inną kartę)

**Problem**: Użytkownik tworzy nowy dokument, uzupełnia go, przechodzi na inną kartę przeglądarki, dokument się zamyka i dane są tracone.

Obecny kod: `beforeunload` event jest obsługiwany (linie 354-368) — ostrzega przed zamknięciem/odświeżeniem karty. Ale przejście na inną kartę (visibility change) nie powinno zamykać dialogu. Problem może leżeć w re-renderze komponentu lub w `isOpen` propie, który może się zmienić.

Bardziej prawdopodobne: React Query refetch on window focus (`refetchOnWindowFocus: true` — domyślnie) może odświeżyć listę dokumentów, powodując re-render rodzica, co zamyka dialog. Albo `onAuthStateChange` w AuthContext odpalony po powrocie do karty może zmienić stan `user`, co triggeruje re-render.

**Rozwiązanie**: 
1. Dodać `useEffect` z `visibilitychange` event, który zapobiega zamykaniu dialogu przy zmianie karty.
2. Skonfigurować React Query z `refetchOnWindowFocus: false` dla zapytań w DocumentDialog.
3. W `handleDialogOpenChange` (linia 477) — upewnić się, że dialog nie zamyka się samoistnie.

**Pliki**: 
- `src/pages/Documents/DocumentDialog.tsx` — dodać auto-save na `visibilitychange` lub przynajmniej nie zamykać dialogu.
- Potencjalnie `src/main.tsx` lub konfiguracja QueryClient — `refetchOnWindowFocus`.

---

## Podsumowanie zmian do wdrożenia

| # | Problem | Plik | Zmiana |
|---|---------|------|--------|
| 1 | Split tworzy wiersz 0.00 | `DocumentDialog.tsx` | Guard na `balanceAmount < 0.01`, ukrycie przycisku split dla zerowych wierszy |
| 2a | Export dodaje pozycje z innego miesiąca | `Mt940ImportDialog.tsx` | Użyć `documentDate` zamiast `transaction.date` przy imporcie |
| 2b | Błąd przewalutowania w podsumowaniu | `DocumentDialog.tsx` | Ukryć dolny wiersz PLN gdy `showInPLN=true`, poprawić labelki |
| 2c | Numer dokumentu nie zmienia się | `DocumentDialog.tsx` + `DocumentsPage.tsx` | Zweryfikować przekazywanie `location_id` do edytowanego dokumentu |
| 2d | Utrata danych po zmianie karty | `DocumentDialog.tsx` | Auto-zapis lub draft na `visibilitychange`, wyłączyć `refetchOnWindowFocus` |

