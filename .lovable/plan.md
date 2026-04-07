

## Problem

Funkcja wykrywania kont prowincjalnych (`shouldCreateProvincialFee`) ma poprawny warunek logiczny (sprawdza Wn OR Ma), ale zawodzi przez **race condition** — dane (`accounts`, `triggerPrefixes`, `settings`) mogą nie być załadowane w momencie wywołania, co powoduje ciche `return false`.

## Rozwiązanie

### 1. Hook `useProvincialFee.ts` — dodanie `isReady`

- Nowa flaga: `isReady = Boolean(accounts?.length > 0 && settings && triggerPrefixes)`
- Eksportować `isReady` z hooka
- `console.warn` gdy `getAccountPrefix` nie znajduje konta (diagnostyka)

### 2. `DocumentDialog.tsx` — guard na `isReady`

- Przed wywołaniem `shouldCreateProvincialFee` sprawdzać `isReady`
- Jeśli `!isReady` i konfiguracja istnieje — nie blokować UI, ale odłożyć sprawdzenie do momentu gdy dane będą gotowe (useEffect)

### 3. Importery — blokada gdy dane nie gotowe

W każdym importerze (`CsvImportDialog`, `Mt940ImportDialog`, `ExcelFormImportDialog`, `KpirImportDialog`):
- Użyć `isReady` z hooka
- Jeśli `isConfigured && !isReady` — wyświetlić ostrzeżenie i zablokować przycisk importu
- Jeśli `!isConfigured` — import bez zmian (brak konfiguracji = brak opłat)

### Efekt końcowy

Po wdrożeniu, auto-operacja "procent na prowincję" będzie tworzona gdy konto wyzwalające jest:
- Po stronie **Wn** (debit) — tak
- Po stronie **Ma** (credit) — tak
- Po **obu stronach** — tak
- Przy **imporcie plików** (CSV, MT940, Excel, KPIR) — tak

### Pliki do modyfikacji
- `src/hooks/useProvincialFee.ts`
- `src/pages/Documents/DocumentDialog.tsx`
- `src/pages/Documents/CsvImportDialog.tsx`
- `src/pages/Documents/Mt940ImportDialog.tsx`
- `src/pages/Documents/ExcelFormImportDialog.tsx`
- `src/pages/KPIR/KpirImportDialog.tsx`

