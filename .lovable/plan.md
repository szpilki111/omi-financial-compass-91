## Plan naprawy 5 zgłoszonych problemów

### 1. Wykres kołowy „Udział w obrotach (Wn + Ma)" czasem pusty
Przyczyna: gdy wybrane konto w danym okresie nie ma żadnych obrotów bieżących (tylko salda otwarcia — np. konto 110 w czerwcu), `pieData` jest pustą tablicą i Recharts nic nie rysuje.

Naprawa w `src/pages/Administration/GlobalAccountTurnovers.tsx`:
- Jeśli `pieData` jest puste → pokazać komunikat „Brak obrotów Wn/Ma w okresie — wykres niedostępny" zamiast pustego białego prostokąta.
- Dodatkowo, jeśli są tylko salda końcowe (a brak obrotów), zaproponować fallback: drugi wykres pokaże udział `|saldo końcowe|` (top 8 + Pozostałe). Tytuł karty dynamiczny.

### 2. Lista placówek/kont wychodzi poza widoczny obszar (zasłania wyszukiwarkę)
Przyczyna: `max-h-[60vh]` liczy względem viewportu, a nie względem dostępnego miejsca pod triggerem. Radix udostępnia CSS var `--radix-select-content-available-height`.

Naprawa: dla obu `SelectContent` (konto + placówka) ustawić:
```
style={{ maxHeight: 'var(--radix-select-content-available-height)' }}
```
oraz dodać `collisionPadding={16}` i usunąć ręczne `max-h-[60vh]`. Wewnętrzna lista (pod sticky inputem) dostanie własny `overflow-y-auto` na opakowującym `<div>`, żeby sticky szukajka zostawała na górze.

### 3. „Bad Request" po kliknięciu „Pokaż" dla konta 110
Przyczyna: konto syntetyczne 110 ma bardzo dużo subkont (per placówka). Filtr `.or('debit_account_id.in.(uuid,…),credit_account_id.in.(uuid,…)')` produkuje URL > 8 KB i PostgREST/Cloudflare odrzuca jako 400 Bad Request. Dodatkowo `or()` z dwoma `in.()` jest delikatne na escape.

Naprawa: zamiast jednego `.or()` zrobić **dwa równoległe zapytania** (`.in('debit_account_id', ids)` i `.in('credit_account_id', ids)`) i scalić wyniki po `id`, deduplikując. Dla każdego z nich użyć `fetchAllRows`. Jeśli `accountIds.length > 500` — chunkować po 500 i `Promise.all`. Ta sama zmiana dla zapytania `prevTx` i `curTx`.

### 4. Po kliknięciu w pole „Konto" auto-fokus na mini-wyszukiwarkę
Naprawa: dodać `onOpenChange` na `<Select>` (konto i placówka). Gdy `open === true` → `requestAnimationFrame(() => accountSearchRef.current?.focus())` (analogicznie `locationSearchRef`). Dodać też brakujący `locationSearchRef`.

### 5. Dokument DOMKOD/2026/05/007 pokazuje 0 transakcji w liście, mimo że transakcje istnieją
Przyczyna w `src/pages/Documents/DocumentsPage.tsx` (linia ~136): bulk-fetch transakcji dla strony dokumentów używa pojedynczego `supabase.from('transactions').select(...).in('document_id', docIds)` — to zapytanie ma **domyślny limit PostgREST = 1000 wierszy**. Gdy łączna liczba transakcji dla 20 dokumentów na stronie przekracza 1000 (a po początku miesiąca, gdy wszystkie dokumenty są tworzone hurtem i mają dużo operacji, łatwo to przekroczyć), część dokumentów (te których `document_id` w wynikach trafia poza limit) dostaje pustą listę → `transaction_count = 0` i `total_amount = 0`. Reszta aplikacji liczy poprawnie, bo nie polega na tym zagregowanym zapytaniu.

Naprawa: zamiast pojedynczego `.in(...)` użyć `fetchAllRows`:
```ts
const allTransactions = await fetchAllRows<...>((from, to) =>
  supabase
    .from('transactions')
    .select('document_id, debit_amount, credit_amount, amount, currency, exchange_rate')
    .in('document_id', docIds)
    .range(from, to)
);
```
To rozwiązuje problem niezależnie od liczby transakcji w dokumentach na danej stronie.

---

### Zakres zmian (pliki)
- `src/pages/Administration/GlobalAccountTurnovers.tsx` — punkty 1, 2, 3, 4
- `src/pages/Documents/DocumentsPage.tsx` — punkt 5

### Weryfikacja
- `npm` build przejdzie bez błędów TS.
- Wykres koloowy: dla konta bez obrotów Wn/Ma pojawia się komunikat, nie pusty box.
- Dropdown placówek/kont: lista nigdy nie zachodzi na trigger ani nie wychodzi poza widoczny obszar karty.
- Konto 110 → „Pokaż" zwraca dane bez 400.
- Klik w „Konto" / „Placówka" → kursor od razu w polu „Szukaj…".
- W dokumencie DOMKOD/2026/05/007 pojawia się poprawna liczba operacji i suma kwot.
