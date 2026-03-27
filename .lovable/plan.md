

## Problem: Orientacja pozioma nie działa w eksporcie Excel

### Przyczyna
Biblioteka `xlsx-js-style` (i bazowy SheetJS) **nie zapisuje** właściwości `!pageSetup` do pliku XLSX — jest to funkcja dostępna wyłącznie w wersji komercyjnej (Pro). Ustawienie `ws['!pageSetup'] = { orientation: 'landscape' }` jest po prostu ignorowane podczas zapisu.

### Rozwiązanie
Użyć **JSZip** (już dostępny jako zależność SheetJS) do ręcznej modyfikacji XML wewnątrz pliku XLSX po jego wygenerowaniu. Plik XLSX to archiwum ZIP — wystarczy:

1. Wygenerować plik jako `ArrayBuffer` zamiast zapisywać go od razu (`XLSX.write(wb, { type: 'array' })`)
2. Otworzyć go przez JSZip
3. W pliku `xl/worksheets/sheet1.xml` wstrzyknąć tag `<pageSetup>` z `orientation="landscape"`, `fitToWidth="1"`, `fitToHeight="0"`
4. Dodać `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` na początku XML
5. Zapisać zmodyfikowany ZIP i pobrać jako plik

### Plik do zmiany
`src/pages/AccountSearch/AccountSearchPage.tsx` — fragment `handleExportToExcel` (linie 530-538)

### Szczegóły techniczne
Zamiast:
```typescript
ws['!pageSetup'] = { orientation: 'landscape', ... };
XLSX.writeFile(wb, fileName);
```

Będzie:
```typescript
import JSZip from 'jszip';

const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
const zip = await JSZip.loadAsync(wbOut);
const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');

// Wstrzyknięcie pageSetup i fitToPage
const modifiedXml = sheetXml
  .replace('</worksheet>', '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>')
  .replace('<worksheet', '<worksheet')
  .replace(/<sheetPr[^/]*\/>|<sheetPr>.*?<\/sheetPr>/s, '')
  .replace('<sheetData', '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetData');

zip.file('xl/worksheets/sheet1.xml', modifiedXml);
const blob = await zip.generateAsync({ type: 'blob' });
saveAs(blob, fileName); // z file-saver lub URL.createObjectURL
```

Funkcja `handleExportToExcel` stanie się `async`. Trzeba dodać `jszip` do dependencies (sprawdzę czy już jest jako transitive dep od xlsx).

