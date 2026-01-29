
# Plan implementacji: Przeprojektowanie struktury raportów miesięcznych

## Podsumowanie zmian

Raport wymaga kompleksowego przeprojektowania zgodnie z dostarczonym wzorem papierowym. Zmiany obejmują:
- Usunięcie sekcji "Podsumowanie finansowe" z widoku szczegółów raportu
- Zmiana struktury tabeli "Stan finansowy domu" (A)
- Zmiana struktury tabeli "Intencje" (B)
- Usunięcie sekcji "Towary" (już usunięta - OK)
- Zmiana struktury tabeli "Należności i zobowiązania" (D)
- Zmiana rozpiski kont na drugiej stronie (tylko 400 dla kosztów, tylko 700 dla przychodów)

---

## Szczegółowe zmiany na stronie 1

### A. Stan finansowy domu - NOWA STRUKTURA

| Pozycja | Konta | Kolumny |
|---------|-------|---------|
| 1. Kasa domu | 100-109 | Początek miesiąca, Uznania (Wn), Obciążenia (Ma), Koniec miesiąca |
| ~~2. Kasa dewiz~~ | ~~101-108~~ | **USUNĄĆ** |
| 2. Bank | 110-116 | j.w. |
| 3. Lokaty | 117 | j.w. |
| ~~5. Bank dewizowy~~ | ~~113-116~~ | **USUNĄĆ** |
| **SALDO** | suma | suma kolumn |

**Wzór na koniec miesiąca:** `Początek miesiąca + Uznania - Obciążenia`

### B. Intencje - konto 210

| Kolumna | Źródło |
|---------|--------|
| Początek miesiąca | Saldo z poprzedniego okresu |
| Odprawione i oddane | Suma 210 po stronie **Ma** |
| Przyjęte | Suma 210 po stronie **Wn** |
| Stan końcowy | Początek + Przyjęte - Odprawione |

### C. Należności i zobowiązania - NOWA STRUKTURA

| Pozycja | Konta | Kolumny |
|---------|-------|---------|
| 1. Pożyczki udzielone | 212, 213 | Początek, Należności (Wn), Zobowiązania (Ma), Koniec |
| 2. Pożyczki zaciągnięte | 215 | j.w. |
| ~~3. Sumy przechodnie~~ | ~~149, 150~~ | **USUNĄĆ** |
| 3. Rozliczenia z prowincją | 201 | j.w. |
| 4. Rozliczenia z innymi | 217 | j.w. |

**Wzór na koniec miesiąca:** `Początek + Należności - Zobowiązania`

---

## Szczegółowe zmiany na stronie 2 (rozpiska kont)

### I. PRZYCHODY - tylko konta 700
**Usunąć konta 2xx** z listy przychodów:
- ~~210 - Intencje przyjęte~~
- ~~212 - Zwrot pożyczki~~
- ~~215 - Zaciągnięte pożyczki~~
- ~~217 - Sumy przechodnie~~
- ~~225 - Sprzedaż towarów~~

**Zostawić tylko:**
701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 725, 727, 728, 730

### II. ROZCHODY - tylko konta 400
**Usunąć konta 2xx** z listy rozchodów:
- ~~210 - Intencje odprawione~~
- ~~212 - Udzielone pożyczki~~
- ~~215 - Spłata pożyczek~~
- ~~217 - Sumy przechodnie~~
- ~~225 - Zakup towarów~~
- ~~201-1-1 - Świadczenia na prowincję~~

**Zostawić tylko konta 4xx:**
401-410, 411-413, 420-424, 430-431, 435, 440-447, 449-459

---

## Pliki do modyfikacji

### 1. `src/components/reports/ReportFinancialStatusTable.tsx`
- Zmienić `DEFAULT_CATEGORIES` na:
  - 1. Kasa domu: 100-109
  - 2. Bank: 110-116
  - 3. Lokaty: 117
- Zmienić nazwy kolumn na: "Początek miesiąca", "Uznania", "Obciążenia", "Koniec miesiąca"
- Zmienić wzór kalkulacji: `opening + uznania - obciążenia`

### 2. `src/components/reports/ReportIntentionsTable.tsx`
- Dostosować do konta 210
- Uznania = strona Wn (przyjęte)
- Obciążenia = strona Ma (odprawione i oddane)
- Wzór: `początek + przyjęte - odprawione`

### 3. `src/components/reports/ReportLiabilitiesTable.tsx`
- Zmienić `DEFAULT_LIABILITY_CATEGORIES`:
  - 1. Pożyczki udzielone: 212, 213
  - 2. Pożyczki zaciągnięte: 215
  - 3. Rozliczenia z prowincją: 201
  - 4. Rozliczenia z innymi: 217
- Usunąć "Sumy przechodnie"
- Zmienić kolumny na: "Początek miesiąca", "Należności", "Zobowiązania", "Koniec miesiąca"

### 4. `src/components/reports/ReportIncomeSection.tsx`
- Usunąć z `INCOME_ACCOUNTS` wszystkie konta 2xx (210, 212, 215, 217, 225)
- Zostawić tylko konta 7xx

### 5. `src/components/reports/ReportExpenseSection.tsx`
- Usunąć z `EXPENSE_ACCOUNTS` wszystkie konta 2xx (210, 212, 215, 217, 225, 201-1-1)
- Zostawić tylko konta 4xx
- Usunąć sekcję "Świadczenia na prowincję"

### 6. `src/components/reports/ReportViewFull.tsx`
- Zaktualizować logikę pobierania danych zgodnie z nowymi definicjami kont
- Poprawić przekazywanie danych do tabel

### 7. `src/pages/Reports/ReportDetails.tsx`
- Usunąć sekcję "Podsumowanie finansowe" (linie 451-481 z komponentem KpirSummary)
- Zostawić nagłówki "Przychody razem" i "Rozchody razem" na górze raportu

### 8. `src/components/reports/ExportToExcelFull.tsx`
- Zaktualizować `INCOME_ACCOUNTS` - usunąć 2xx
- Zaktualizować `EXPENSE_ACCOUNTS` - usunąć 2xx
- Zaktualizować `FINANCIAL_STATUS_CATEGORIES`
- Zaktualizować `LIABILITY_CATEGORIES`

### 9. `src/components/reports/ReportPDFGeneratorCompact.tsx`
- Zaktualizować strukturę PDF zgodnie z nowym układem
- Usunąć sekcję "Podsumowanie finansowe"

### 10. `src/utils/financeUtils.ts`
- Zmienić `calculateFinancialSummary` - przychody tylko 7xx, koszty tylko 4xx
- Usunąć konta 2xx z kalkulacji przychodów i kosztów

---

## Diagram nowej struktury raportu

```text
┌─────────────────────────────────────────────────────────────┐
│ STRONA 1                                                    │
├─────────────────────────────────────────────────────────────┤
│ [Nagłówek: Nazwa placówki, adres, data]                     │
│                                                             │
│ SPRAWOZDANIE MIESIĘCZNE ZA OKRES: [MIESIĄC] [ROK] r.        │
│                                                             │
│ PRZYCHODY RAZEM: xxx,xx                                     │
│ ROZCHODY RAZEM:  xxx,xx                                     │
├─────────────────────────────────────────────────────────────┤
│ A. Stan finansowy domu                                      │
│    ┌────────────┬──────────┬─────────┬──────────┬──────────┐│
│    │            │Początek  │Uznania  │Obciążenia│Koniec    ││
│    ├────────────┼──────────┼─────────┼──────────┼──────────┤│
│    │1.Kasa domu │  xxx,xx  │  xxx,xx │  xxx,xx  │  xxx,xx  ││
│    │2.Bank      │  xxx,xx  │  xxx,xx │  xxx,xx  │  xxx,xx  ││
│    │3.Lokaty    │  xxx,xx  │  xxx,xx │  xxx,xx  │  xxx,xx  ││
│    ├────────────┼──────────┼─────────┼──────────┼──────────┤│
│    │SALDO       │  xxx,xx  │  xxx,xx │  xxx,xx  │  xxx,xx  ││
│    └────────────┴──────────┴─────────┴──────────┴──────────┘│
├─────────────────────────────────────────────────────────────┤
│ B. Intencje                                                 │
│    ┌────────────┬──────────┬──────────────┬────────┬───────┐│
│    │            │Początek  │Odpr.i oddane │Przyjęte│Koniec ││
│    ├────────────┼──────────┼──────────────┼────────┼───────┤│
│    │1.Intencje  │  xxx,xx  │    xxx,xx    │ xxx,xx │xxx,xx ││
│    └────────────┴──────────┴──────────────┴────────┴───────┘│
├─────────────────────────────────────────────────────────────┤
│ C. Należności i zobowiązania                                │
│    ┌─────────────────────┬─────────┬──────────┬───────┬────┐│
│    │                     │Początek │Należności│Zobowiąz│Kon.││
│    ├─────────────────────┼─────────┼──────────┼───────┼────┤│
│    │1.Pożyczki udzielone │  xxx,xx │  xxx,xx  │xxx,xx │    ││
│    │2.Pożyczki zaciągn.  │  xxx,xx │  xxx,xx  │xxx,xx │    ││
│    │3.Rozl. z prowincją  │  xxx,xx │  xxx,xx  │xxx,xx │    ││
│    │4.Rozl. z innymi     │  xxx,xx │  xxx,xx  │xxx,xx │    ││
│    └─────────────────────┴─────────┴──────────┴───────┴────┘│
├─────────────────────────────────────────────────────────────┤
│ [Podpisy: Superior, Ekonom, Proboszcz, I Radny, II Radny]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STRONA 2                                                    │
├─────────────────────────────────────────────────────────────┤
│ I. PRZYCHODY (tylko konta 7xx)                              │
│    ┌────────────┬─────────────────────────────┬─────────────┐
│    │Nr. konta   │Treść                        │kwota        │
│    ├────────────┼─────────────────────────────┼─────────────┤
│    │701         │Intencje odprawione na dom   │    xxx,xx   │
│    │702         │Duszpasterstwo OMI           │    xxx,xx   │
│    │...         │...                          │    ...      │
│    ├────────────┼─────────────────────────────┼─────────────┤
│    │            │PRZYCHODY RAZEM:             │  xxx xxx,xx │
│    └────────────┴─────────────────────────────┴─────────────┘
├─────────────────────────────────────────────────────────────┤
│ II. ROZCHODY (tylko konta 4xx)                              │
│    ┌────────────┬─────────────────────────────┬─────────────┐
│    │Nr. konta   │Treść                        │kwota        │
│    ├────────────┼─────────────────────────────┼─────────────┤
│    │401..410    │Funkcjonowanie domu          │    xxx,xx   │
│    │411..413    │Podróże, samochody           │    xxx,xx   │
│    │...         │...                          │    ...      │
│    ├────────────┼─────────────────────────────┼─────────────┤
│    │            │ROZCHODY RAZEM:              │  xxx xxx,xx │
│    └────────────┴─────────────────────────────┴─────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## Szczegóły techniczne

### Nowe definicje kategorii stanu finansowego

```typescript
const FINANCIAL_STATUS_CATEGORIES = [
  { 
    key: 'kasa_domu', 
    name: '1. Kasa domu', 
    accounts: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109'] 
  },
  { 
    key: 'bank', 
    name: '2. Bank', 
    accounts: ['110', '111', '112', '113', '114', '115', '116'] 
  },
  { 
    key: 'lokaty', 
    name: '3. Lokaty bankowe', 
    accounts: ['117'] 
  },
];
```

### Nowe definicje kategorii należności/zobowiązań

```typescript
const LIABILITY_CATEGORIES = [
  { key: 'loans_given', name: '1. Pożyczki udzielone', accounts: ['212', '213'] },
  { key: 'loans_taken', name: '2. Pożyczki zaciągnięte', accounts: ['215'] },
  { key: 'province', name: '3. Rozliczenia z prowincją', accounts: ['201'] },
  { key: 'others', name: '4. Rozliczenia z innymi', accounts: ['217'] },
];
```

### Nowa lista kont przychodów (tylko 7xx)

```typescript
const INCOME_ACCOUNTS = [
  { number: '701', name: 'Intencje odprawione na dom' },
  { number: '702', name: 'Duszpasterstwo OMI' },
  { number: '703', name: 'Duszpasterstwo parafialne' },
  { number: '704', name: 'Kolęda' },
  { number: '705', name: 'Zastępstwa zagraniczne' },
  { number: '710', name: 'Odsetki' },
  { number: '711', name: 'Sprzedaż towarów' },
  { number: '712', name: 'Dzierżawa' },
  { number: '714', name: 'Pensje, emerytury' },
  { number: '715', name: 'Zwroty' },
  { number: '716', name: 'Usługi' },
  { number: '717', name: 'Inne' },
  { number: '718', name: 'Rekolektanci' },
  { number: '719', name: 'Dzierżawa przechodnia' },
  { number: '720', name: 'Ofiary' },
  { number: '722', name: 'Pensje katechetów' },
  { number: '725', name: 'Nadzwyczajne' },
  { number: '727', name: 'Ogród' },
  { number: '728', name: 'Gospodarstwo' },
  { number: '730', name: 'Sprzedaż majątku trwałego' },
];
```

### Nowa lista kont kosztów (tylko 4xx)

```typescript
const EXPENSE_ACCOUNTS = [
  { number: '401..410', name: 'Funkcjonowanie domu' },
  { number: '411..413', name: 'Podróże, samochody' },
  { number: '420', name: 'Pensje pracowników' },
  { number: '421..422', name: 'Osobiste' },
  { number: '423', name: 'Formacja ustawiczna' },
  { number: '424', name: 'Leczenie' },
  { number: '430', name: 'Kaplica' },
  { number: '431', name: 'Książki, czasopisma' },
  { number: '435', name: 'Wakacje' },
  { number: '440', name: 'Żywność' },
  { number: '441', name: 'Salon' },
  { number: '442', name: 'Odzież' },
  { number: '443', name: 'Pralnia' },
  { number: '444', name: 'Energia, woda' },
  { number: '445', name: 'Podatki' },
  { number: '446, 447', name: 'Ogród, Gospodarstwo' },
  { number: '449', name: 'Zakup towarów do sprzedaży' },
  { number: '450', name: 'Inne' },
  { number: '451', name: 'Remonty zwyczajne' },
  { number: '452', name: 'Remonty nadzwyczajne' },
  { number: '453', name: 'Spotkania, zjazdy' },
  { number: '455', name: 'Studia' },
  { number: '456', name: 'Powołania' },
  { number: '457', name: 'Apostolat' },
  { number: '458..459', name: 'Biedni, misje' },
];
```

---

## Szacowany czas realizacji

| Etap | Pliki | Czas |
|------|-------|------|
| Aktualizacja definicji kategorii i kont | 4 pliki | 1h |
| Zmiana struktury tabel (kolumny, wzory) | 3 pliki | 1.5h |
| Usunięcie sekcji "Podsumowanie finansowe" | 1 plik | 0.5h |
| Aktualizacja logiki pobierania danych | 2 pliki | 1h |
| Aktualizacja eksportu Excel | 1 plik | 0.5h |
| Aktualizacja generatora PDF | 1 plik | 1h |
| Aktualizacja financeUtils | 1 plik | 0.5h |
| Testy i poprawki | - | 1h |
| **Razem** | **~10 plików** | **~7 godzin** |

