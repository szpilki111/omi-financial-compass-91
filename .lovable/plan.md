## Plan: pełna realizacja wszystkiego (36 h, full approve) — bez 2.2

Wszystko z `.lovable/plan.md` ma być realnie wdrożone i zweryfikowane. Wyłączamy tylko **2.2** (cennik demo, poza kodem).

---

### Stan obecny — ZAMKNIĘTE

- [x] 1.1, 1.2, 1.3, 1.4 — zrobione we wcześniejszych iteracjach.
- [x] 1.5 — narzędzie weryfikacji: filtr „tylko placówka" + drill-down + link
      `Otwórz w module Konta` (`/wyszukaj-konta?account=…&year=…`).
- [x] 2.1 MVP — zakładka „Obroty i salda (globalnie)" odsłonięta w Administracji.
- [x] 2.1 standard — drill-down (Dialog z listą transakcji, sumy Wn/Ma, saldo),
      przełącznik „per pełne konto" (rozbicie 201-…-1 vs 201-…-2),
      multi-sheet XLSX (Razem + per poziom + opcjonalnie „Per konto").
- [x] 2.1 rozszerzony — BarChart (top 30 sald końcowych) + PieChart
      (udział w obrotach Wn + Ma, top 8 + „Pozostałe").
- [ ] 2.2 — poza zakresem aplikacji (cennik demo, opracowuje użytkownik).

---

### A. Przywrócenie zakładki 2.1

Plik: `src/pages/Administration/AdministrationPage.tsx`
- Usunąć obie flagi `false &&` (przy `TabsTrigger` i `TabsContent` dla `global-turnovers`).
- Pozostawić warunek roli `admin` / `prowincjal`.

---

### B. 2.1 wariant standard — drill-down i rozbicia

Plik: `src/pages/Administration/GlobalAccountTurnovers.tsx`

#### B1. Drill-down z wiersza placówki do listy transakcji
- Każdy wiersz tabeli wyniku ma kolumnę „Akcje" z przyciskiem `Eye` → otwiera `Dialog` (`@/components/ui/dialog`) z listą transakcji danej placówki na wskazanym koncie w wybranym okresie.
- W dialogu: tabela `data | numer dokumentu | opis | Wn (PLN) | Ma (PLN) | konto pełne`, sortowanie po dacie rosnąco.
- Dane: dorzucić do `runQuery` selekcję pól `id, date, description, document_id, debit_account.number, credit_account.number` (już w zapytaniu `curTx`); trzymać `curTx` w stanie i filtrować w pamięci po `location_id` i prefiksie.
- Stopka dialogu: sumy Wn / Ma + saldo okresu.
- Drugi przycisk w dialogu: „Otwórz w module Konta" — `useNavigate` do `/konta` z query stringiem `?location=<id>&accountPrefix=<prefix>&dateFrom=<...>&dateTo=<...>` (sparsować w `AccountSearchPage` — patrz D).

#### B2. Rozbicie per konto syntetyczne pełnego numeru
- W tabeli głównej dodać przełącznik (`Switch`) „Pokaż per pełne konto". Gdy włączony, agregacja jest nie po `location_id`, ale po `(location_id, fullAccountNumber)` — używamy całego `accounts.number`, nie samego prefiksu. Wyświetlamy kolumnę „Konto" przed „Placówka".
- Pomocna gdy prefix `201` rozbija się na `201-{loc}-1`, `201-{loc}-2`.

#### B3. Multi-sheet XLSX
- Funkcja `exportXlsx`:
  - sheet 1 „Razem" (obecny output),
  - sheet 2..N po jednym dla każdego poziomu (`Prowincja`, `Domy`, `Parafie`, `Dzieła OMI`) z tymi samymi kolumnami i sumą,
  - jeśli włączony przełącznik per-konto (B2), dodatkowy sheet „Per konto".
- Nagłówki pogrubione, autosize kolumn jak dziś, format PLN.

---

### C. 2.1 wariant rozszerzony — wykresy

Plik: `src/pages/Administration/GlobalAccountTurnovers.tsx`

- Import: `import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'` (recharts już w projekcie).
- `useMemo` `barData`: rekordy `Math.abs(closing) > 0.01`, sort desc po `closing`, top 30; `{ id, name: identifier, closing, locationName }`. Komunikat „pokazano 30 z N" gdy więcej niż 30.
- `useMemo` `pieData`: per placówka `debit + credit`, sort desc, top 8 + „Pozostałe"; udział %.
- Siatka `grid gap-4 md:grid-cols-2` nad tabelą (renderowana tylko gdy `results.length > 0`):
  - **BarChart** „Salda końcowe (placówki)": X = `identifier`, Y = PLN; `Cell fill={r.closing >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}`; tooltip: `locationName` + `formatPLN(closing)`.
  - **PieChart** „Udział w obrotach (Wn + Ma)": `dataKey="value"`; kolory cyklicznie z `hsl(var(--chart-1))`..`hsl(var(--chart-5))`; legenda + tooltip `formatPLN` + `%`.
- Każdy wykres w `ResponsiveContainer` o wysokości `h-72`.

---

### D. Pkt 1.5 — narzędzie weryfikacyjne dla Laskowic

Pliki: `src/pages/Administration/GlobalAccountTurnovers.tsx`, `src/pages/AccountSearch/AccountSearchPage.tsx`

- `AccountSearchPage`: przy mountcie czytać `useSearchParams` i jeśli są `location`, `accountPrefix`, opcjonalnie `dateFrom`/`dateTo` — prefillować stan i automatycznie wywoływać wyszukiwanie.
- W drill-down dialogu (B1) przycisk „Otwórz w module Konta" buduje URL z tych parametrów.
- Dodatkowo w `GlobalAccountTurnovers`: filtr „Tylko placówka…" (dropdown po `locations`) — ułatwia ojcu wskazanie Laskowic i porównanie sald.

---

### E. Aktualizacja `.lovable/plan.md`

- Sekcja 3:
  - `[x] 2.1  podgląd obrotów i sald — pełny pakiet (MVP + standard + rozszerzony)` z listą podpunktów: zakładka aktywna, drill-down, per-konto-syntetyczne, multi-sheet XLSX, wykresy.
  - `[x] 1.5  narzędzie weryfikacji w module Obroty i salda + drill-down do AccountSearchPage; korekta historyczna pozostaje do osobnego zlecenia po decyzji ojca`.
  - `[ ] 2.2` — wyraźnie poza zakresem aplikacji.

---

### Weryfikacja po wdrożeniu

1. Login jako admin → `/administracja` → zakładka „Obroty i salda (globalnie)" widoczna i otwiera moduł.
2. Konto `100`, miesiąc bieżący → tabela + dwa wykresy się renderują; eksport XLSX = wiele arkuszy (Razem, Prowincja, Domy, Parafie, Dzieła).
3. Konto `201`, rok, przełącznik per-konto włączony → wiersze rozbite na `201-…-1` i `201-…-2`; eksport zawiera arkusz „Per konto".
4. Kliknięcie wiersza (placówka) → dialog z transakcjami; sumy Wn/Ma zgadzają się z wierszem tabeli; przycisk „Otwórz w module Konta" przenosi do `AccountSearchPage` z prefillem i auto-wynikiem.
5. Build TS bez błędów; brak ostrzeżeń recharts w konsoli.

---

### Poza zakresem (świadomie)

- 2.2 — cennik demo, opracowuje użytkownik poza aplikacją.
- Migracja historycznych sald Laskowic — wymaga oddzielnej akceptacji po weryfikacji.
