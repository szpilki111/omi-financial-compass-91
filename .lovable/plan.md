
# Plan naprawy 4 problemow w raportach i dokumentach

## Problem 1: Kolumny w Excelu za waskie -- tekst sie ucina

**Przyczyna:** Sztywne szerokosci kolumn w ExportToExcelFull.tsx:
- Strona 1: kolumna nazw = 27 znakow, kolumny kwot = 14 znakow
- Strona 2: kolumna nazw przychodow = 19 znakow, rozchodow = 18 znakow

**Rozwiazanie:**
- Strona 1: Poszerzyc kolumne nazw z 27 do 32, kolumny kwot z 14 do 16
- Strona 2: Poszerzyc kolumny nazw z 19/18 do 24/22, kolumny kwot z 11.5/13 do 14
- Usunac funkcje `truncateName()` ktora obcina nazwy kont -- po poszerzeniu kolumn nie bedzie potrzebna

## Problem 2: Kwoty jako zwykle liczby zamiast wartosci walutowych

**Przyczyna:** Dane numeryczne wstawiane sa jako surowe liczby (np. `97138`) bez formatowania walutowego.

**Rozwiazanie:** Ustawic format walutowy `#,##0.00` na wszystkich komorkach z kwotami w obu arkuszach. Uzyc xlsx-js-style property `numFmt` na komorkach numerycznych:
```
{ numFmt: '#,##0.00', font: { sz: 11 } }
```
Dzieki temu Excel wyswietli np. `97 138,00` zamiast `97138`.

## Problem 3: Swiadczenia na prowincje pokazuja same zera

**Przyczyna:** Kod w ExportToExcelFull.tsx (linia 169) szuka kont `200-2-15-*` tylko po stronie **Ma (credit)**, ale faktyczne transakcje prowincyjne ksieguja sie po stronie **Wn (debit)**:
```
200-2-15-2 (Wn) -> 201-2-15-1 (Ma)  // kontrybucje = 10200
200-2-15-4 (Wn) -> 201-2-15-1 (Ma)  // ZUS OMI = 8500
```

**Rozwiazanie:** Dodac analogiczna logike sledzenia obrotow prowincjalnych rowniez po stronie debit (Wn). Konta `200-*` na stronie Wn reprezentuja naliczenie swiadczen na prowincje.

## Problem 4: Podpisy w domu -- "PROBOSZCZ" zamiast "Radni"

**Przyczyna:** W ExportToExcelFull.tsx (linia 388) podpisy dla domu to:
```
["SUPERIOR", "EKONOM", "PROBOSZCZ", "Radni"]
```
Wedlug wydruku referencyjnego ze zdjecia, dom powinien miec:
```
SUPERIOR | EKONOM | Radni
```
(bez PROBOSZCZ). Proboszcz jest tylko w parafii.

**Rozwiazanie:**
- Dom (isDom): `["SUPERIOR", "", "EKONOM", "", "Radni"]` -- 3 podpisy rozmieszczone z odstepami
- Parafia (!isDom): `["SUPERIOR", "EKONOM", "PROBOSZCZ"]` -- jak jest teraz

Rowniez poprawic podpisy w ReportPDFGeneratorCompact.tsx (PDF), ktory tez ma "Proboszcz" w podpisach (linia 442) zamiast warunkowego wyswietlania.

## Problem 5: Nie wszystkie dokumenty ze stycznia sa blokowane po zlozeniu raportu

**Przyczyna:** Blokada dokumentow (ustawianie `validation_errors`) dzieje sie TYLKO przy zatwierdzeniu raportu (akcja `approved` w ReportApprovalActions.tsx, linia 110). Problem z datami -- `new Date(2026, 0, 1).toISOString().split('T')[0]` w strefie UTC+1 daje `"2025-12-31"` zamiast `"2026-01-01"`, wiec dokumenty z poczatku miesiaca moga nie byc objete zakresem.

**Rozwiazanie:** Zamiast `new Date().toISOString().split('T')[0]`, uzyc bezpiecznego formatu dat:
```typescript
const startDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
const lastDay = new Date(reportYear, reportMonth, 0).getDate();
const endDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
```
To eliminuje problem stref czasowych. Poprawic zarowno w `handleApproval` jak i `handleUnlock`.

---

## Podsumowanie zmian technicznych

| Plik | Zmiana |
|------|--------|
| `src/components/reports/ExportToExcelFull.tsx` | Poszerzyc kolumny, dodac format walutowy `numFmt`, naprawic logike swiadczen prowincjalnych (debit), poprawic podpisy domu |
| `src/components/reports/ReportApprovalActions.tsx` | Naprawic generowanie dat (timezone bug) w handleApproval i handleUnlock |
| `src/components/reports/ReportPDFGeneratorCompact.tsx` | Poprawic podpisy -- warunkowo dom vs parafia |
