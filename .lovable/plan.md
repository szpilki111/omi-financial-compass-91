

## Problem

Logika automatycznego generowania operacji "procent na prowincję" istnieje tylko w `DocumentDialog.tsx`. Importy (CSV, MT940, Excel, KPIR) omijają tę logikę — transakcje trafiają bezpośrednio do bazy bez sprawdzania kont prowincjalnych.

## Rozwiązanie

Wydzielić logikę provincial fee do wspólnego hooka/utilsa i zastosować go we wszystkich importerach.

### 1. Nowy hook: `src/hooks/useProvincialFee.ts`

Wydzielenie z `DocumentDialog.tsx` logiki:
- Pobieranie `provincial_fee_settings` i `provincial_fee_accounts`
- Funkcja `generateProvincialFeeTransaction(baseTransaction)` — sprawdza czy konto Wn/Ma pasuje do prefiksu wyzwalającego, jeśli tak — zwraca dodatkową transakcję z wyliczoną kwotą
- Funkcja `resolveAccountByPrefix(prefix, accounts)` — rozwiązywanie prefiksu na UUID konta

### 2. Modyfikacja importerów

W każdym importerze, po przygotowaniu listy transakcji do importu, przed `supabase.insert()`:
- Iteracja po transakcjach
- Dla każdej: sprawdzenie czy konto Wn lub Ma pasuje do prefiksu prowincjalnego
- Jeśli tak: wygenerowanie dodatkowej transakcji i dodanie jej do listy
- Import obu transakcji razem (bazowa + prowincjalna)

Pliki do modyfikacji:
- `src/pages/Documents/CsvImportDialog.tsx`
- `src/pages/Documents/Mt940ImportDialog.tsx`
- `src/pages/Documents/ExcelFormImportDialog.tsx`
- `src/pages/KPIR/KpirImportDialog.tsx`

### 3. Refaktor DocumentDialog.tsx

Zamiana inline logiki na użycie nowego hooka `useProvincialFee`, aby uniknąć duplikacji kodu.

### Pliki do utworzenia
- `src/hooks/useProvincialFee.ts`

### Pliki do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx` (refaktor na hook)
- `src/pages/Documents/CsvImportDialog.tsx`
- `src/pages/Documents/Mt940ImportDialog.tsx`
- `src/pages/Documents/ExcelFormImportDialog.tsx`
- `src/pages/KPIR/KpirImportDialog.tsx`

