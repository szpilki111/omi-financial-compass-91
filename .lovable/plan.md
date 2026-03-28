

## Problem: Uszkodzone pliki Excel po modyfikacji XML przez JSZip

### Przyczyna
Wstrzykiwanie tagów XML (`<sheetPr>`, `<pageSetup>`) do pliku XLSX za pomocą JSZip psuje strukturę pliku. Microsoft Excel jest bardzo rygorystyczny co do kolejności elementów w XML (standard Open XML wymaga ścisłej kolejności), podczas gdy LibreOffice jest bardziej tolerancyjny. Wstawione tagi mogą naruszać wymaganą kolejność lub brakuje im wymaganych atrybutów namespace.

### Rozwiązanie
Usunąć całą logikę JSZip i wrócić do prostego `XLSX.writeFile()`, które generuje poprawny plik. Orientacja landscape jest „nice-to-have" — działający plik Excel jest priorytetem.

### Plik: `src/pages/AccountSearch/AccountSearchPage.tsx`

1. **Usunąć importy** `JSZip` i `saveAs` (file-saver)
2. **Zastąpić blok JSZip** (linie 537-569) prostym:
   ```typescript
   XLSX.writeFile(wb, fileName);
   ```
3. Zachować `!margins` i `!cols` — te działają poprawnie
4. Usunąć `ws['!pageSetup']` — i tak nie jest zapisywany

### Efekt
- Pliki Excel otwierają się bez błędów w MS Excel i LibreOffice
- Utracona zostanie automatyczna orientacja landscape (użytkownik może ręcznie ustawić w Excelu przy drukowaniu)
- Wszystkie pozostałe usprawnienia (filtrowanie po miesiącu, kwoty w PLN, marginesy) zostają zachowane

