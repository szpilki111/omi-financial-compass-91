## Plan naprawy 3 błędów krytycznych

### Błąd 1 — „Utwórz dokument z zaznaczonych operacji" zostawia śmieci w bazie

**Przyczyna (potwierdzona w kodzie)**
W `src/pages/AccountSearch/AccountSearchPage.tsx` (`handleCreateDocumentFromSelected`, linie ~373–474) sekwencja jest:
1. RPC `generate_document_number` — rezerwuje numer (np. `DOMSWK/2026/05/01`).
2. `INSERT INTO documents` — dokument trafia do bazy z `validation_errors`, ale bez kont.
3. `INSERT INTO transactions` — transakcje bez kont (`debit_account_id: null`, `credit_account_id: null`).
4. Dopiero potem otwiera `DocumentDialog` do uzupełnienia.

Jeśli użytkownik anuluje (X / klik poza / Esc) — dokument i puste transakcje zostają w bazie. Do tego `DocumentDialog` po otwarciu już istniejącego rekordu nie pokazuje czerwonego alertu walidacyjnego (nie wczytuje `validation_errors` z DB do stanu `validationErrors`), a `hasUnsavedChanges` jest `false` (formularz nieedytowany), więc dialog zamyka się bez ostrzeżenia.

**Naprawa**
- Przejść na model „draft w pamięci": NIE tworzyć dokumentu w bazie do czasu zapisu. Przekazywać do `DocumentDialog` propsy `initialDocumentDraft` + `initialTransactions` (już istnieje wzorzec dla nowego dokumentu — wykorzystać go).
  - Numer dokumentu generować dopiero w `onSubmit` (tak jak przy zwykłym „Nowy dokument"), żeby nie zużywać numerów na anulowane wpisy.
  - Po pomyślnym zapisie wyczyścić zaznaczenie (`setSelectedTransactionIds([])`) oraz odświeżyć listę.
- Dodać „pas bezpieczeństwa" gdyby ktoś jednak utworzył pusty dokument w przyszłości:
  - W `DocumentDialog` po wczytaniu istniejącego dokumentu, jeśli `validation_errors` zawiera `missing_accounts` (lub jakakolwiek transakcja ma puste konto) — pokazywać czerwony alert na górze dialogu i blokować zamknięcie tak samo jak `checkLastTransactionComplete`.
  - Dodać RPC/edge function albo trigger SQL `prevent_save_without_accounts`: dokument nie może być zapisany bez przynajmniej jednej kompletnej transakcji (Wn + Ma + kwota). Już istnieje walidacja po stronie UI — trzeba ją wzmocnić serwerowo.

### Błąd 2 — saldo otwarcia kwietnia ≠ saldo zamknięcia marca (np. „Gotówka")

**Przyczyna (potwierdzona w kodzie)**
W `src/components/reports/ReportViewFull.tsx`, query `report-opening-balances-calculated-v2` (linie 64–130) pobiera transakcje:

```ts
.from('transactions')
.select(...)
.eq('location_id', locationId)
.lte('date', prevMonthEndStr);
```

Brak paginacji + domyślny limit Supabase **1000 wierszy**. Dla domów takich jak Święty Krzyż, gdzie do końca marca jest >1000 transakcji, część operacji nie wchodzi do salda otwarcia, więc kwiecień startuje z innej kwoty niż zamknięcie marca (a saldo zamknięcia liczone jest z `openingBalance + bieżący miesiąc` w tym samym komponencie, więc tam też propaguje się błąd; ale „Koniec marca" w raporcie marca liczy się z mniejszego okresu i często mieści się w 1000).

To samo ryzyko mają zapytania o saldo otwarcia w innych miejscach (`ReportLiabilitiesTable`, `ExportToExcelFull`, generatory PDF) — sprawdzić i naprawić wszędzie.

**Naprawa**
- Wprowadzić paginację po stronie klienta (pętla `range(from, from+999)` aż do końca) we wszystkich miejscach pobierających historię transakcji do salda otwarcia. Wzorzec już używany w innych modułach (np. eksport kont).
- Lepiej: stworzyć RPC `get_opening_balances(location_id, before_date)` zwracający zagregowane salda po `account_number` po stronie SQL (jeden query, brak limitu wierszy w odpowiedzi, dużo szybsze). Wywoływać z `ReportViewFull`, `ReportLiabilitiesTable`, eksportów Excel/PDF.
- Po naprawie zweryfikować: marzec→kwiecień dla Świętego Krzyża, Laskowic, Poznania, Obry — saldo zamknięcia poprzedniego miesiąca = saldo otwarcia następnego dla każdej kategorii (Kasa, Bank, Lokaty, kategorie pasywne).

### Błąd 3 — brak ostrzeżenia o niezapisanych zmianach przy zamknięciu / odświeżeniu

**Przyczyna (potwierdzona w kodzie)**
W `src/pages/Documents/DocumentDialog.tsx`:
- Linia 360–362: świadomie usunięto `useEffect` który ustawiał `hasUnsavedChanges` na zmianach `transactions` („powodował fałszywe alerty przy wczytywaniu istniejących dokumentów"). Skutek: edycja/dodanie/usunięcie operacji NIE oznacza dokumentu jako brudnego, więc `handleDialogOpenChange` (linia 501) i `handleCloseDialog` (514) zamykają dialog bez pytania.
- `beforeunload` (382–392): `e.preventDefault()` + `e.returnValue = ""` jest aktywne zawsze gdy `isOpen`, ale niektóre przeglądarki wymagają też niepustego stringa (`e.returnValue = "..."`) i de facto nie pyta gdy nie ma realnych zmian — tu chcemy pytać tylko gdy są brudne dane, żeby nie irytować przy podglądzie.

**Naprawa**
- Wprowadzić poprawne tracking „dirty":
  - Po wczytaniu dokumentu (lub otwarciu pustego nowego) zapisać snapshot: `initialFormSnapshot`, `initialTransactionsSnapshot`, `initialParallelSnapshot` (deep clone, tylko istotne pola).
  - Zrobić `useMemo`/`useEffect` `isDirty = !deepEqual(current, initial)` — zarówno dla `form.getValues()`, jak i dla obu list transakcji.
  - Zastąpić `hasUnsavedChanges` tym wyliczanym `isDirty`. Dzięki temu samo otwarcie dokumentu NIE zaznacza go jako brudnego, ale dodanie/edycja/usunięcie operacji TAK.
- Pytać o potwierdzenie zawsze gdy `isDirty` przy:
  - kliknięciu X / kliknięciu poza dialog / Esc — już jest `handleDialogOpenChange`, naprawi się automatycznie po naprawie `isDirty`.
  - próbie zamknięcia/odświeżenia karty — `beforeunload` ma być warunkowy (`if (!isDirty) return;`), ustawiać `e.preventDefault()` + `e.returnValue = "Masz niezapisane zmiany w dokumencie..."`.
  - próbie nawigacji w SPA (np. klik w menu boczne) — dodać blokadę `useBlocker` z React Router (jeśli `react-router-dom` v6.4+ jest dostępne) lub guard w `MainLayout`. Jeśli nie ma blokera, przynajmniej `beforeunload` zabezpieczy odświeżenie.
- `ConfirmCloseDialog` już istnieje i ma 3 opcje (Anuluj / Zamknij bez zapisu / Zapisz) — wystarczy ponownie podpiąć logikę.

### Sekcja techniczna (do wykonania w trybie build)

Pliki do edycji:
- `src/pages/AccountSearch/AccountSearchPage.tsx` — przebudować `handleCreateDocumentFromSelected` na model draftu w pamięci, przekazać dane do `DocumentDialog`.
- `src/pages/Documents/DocumentDialog.tsx` — przyjmować `initialDocumentDraft` + `initialTransactions`, dodać snapshot/`isDirty`, wczytywać `validation_errors` z istniejącego dokumentu, blokować zamknięcie dopóki konta nie uzupełnione, naprawić `beforeunload`.
- `src/components/reports/ReportViewFull.tsx` — paginacja lub RPC dla `report-opening-balances-calculated-v2`.
- `src/components/reports/ReportLiabilitiesTable.tsx`, `src/components/reports/ExportToExcelFull.tsx`, `ReportPDFGenerator(Compact).tsx` — to samo dla każdego miejsca liczącego salda otwarcia.
- (opcjonalnie, zalecane) Migracja: nowa funkcja SQL `public.get_opening_balances(p_location uuid, p_before date)` zwracająca zagregowane salda po `account_number`, używana przez wszystkie raporty.

Weryfikacja po wdrożeniu:
1. Wejść w „Wyszukaj konto" → zaznaczyć kilka operacji → „Utwórz dokument" → zamknąć X bez zapisu → potwierdzić, że żaden nowy dokument NIE pojawił się na liście.
2. Wygenerować raport kwietniowy dla Świętego Krzyża, Laskowic, Poznania, Obry — saldo otwarcia każdej pozycji = saldo zamknięcia z marca.
3. Otworzyć istniejący dokument → dodać operację → kliknąć poza dialog → ma się pojawić `ConfirmCloseDialog`. Otworzyć i tylko podejrzeć (bez zmian) → ma zamknąć bez pytania. Spróbować F5 z brudnym dokumentem → `beforeunload` pyta.