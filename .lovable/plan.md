

# Plan naprawy raportów - przeliczanie walut i formatowanie Excel

## Podsumowanie problemów

| # | Problem | Priorytet | Pliki do modyfikacji |
|---|---------|-----------|---------------------|
| 1 | Raporty pokazują kwoty w walucie oryginalnej zamiast przeliczone na PLN | KRYTYCZNY | `ReportViewFull.tsx`, `ExportToExcelFull.tsx` |
| 2 | Eksport Excel - różne formaty dla domów (2-*) i parafii (3-*) | WYSOKI | `ExportToExcelFull.tsx` |

---

## Problem 1: Raporty nie przeliczają kwot walutowych na PLN (KRYTYCZNY)

### Diagnoza

W kodzie `ReportViewFull.tsx` (linie 137-219) i `ExportToExcelFull.tsx` (linie 116-164) kwoty są pobierane bezpośrednio:

```typescript
// OBECNY KOD - BEZ PRZELICZENIA!
const amount = tx.credit_amount || tx.amount || 0;
incomeMap.set(prefix, (incomeMap.get(prefix) || 0) + amount);
```

Zapytania już pobierają wszystkie kolumny (`*`), więc mamy dostęp do `currency` i `exchange_rate`, ale kod **nie przelicza kwot przez kurs wymiany**.

**Przykład błędu:**
- Transakcja: 1000 EUR, exchange_rate: 4.20
- Raport pokazuje: 1000 zł (błędnie!)
- Powinno pokazać: 4200 zł

### Rozwiązanie

Dodać helper function i użyć jej przy przetwarzaniu transakcji:

```typescript
// Helper do przeliczania kwot walutowych na PLN
const getAmountInPLN = (amount: number, currency?: string, exchangeRate?: number): number => {
  if (!currency || currency === 'PLN') return amount;
  return amount * (exchangeRate || 1);
};

// Użycie w przetwarzaniu transakcji:
transactions?.forEach(tx => {
  if (tx.credit_account) {
    const rawAmount = tx.credit_amount || tx.amount || 0;
    const amount = getAmountInPLN(rawAmount, tx.currency, tx.exchange_rate);
    // ... reszta logiki
  }
});
```

### Pliki do modyfikacji

**1. `src/components/reports/ReportViewFull.tsx`**
- Dodać helper `getAmountInPLN`
- Zmodyfikować przetwarzanie transakcji w linii 142, 183 aby przeliczać kwoty

**2. `src/components/reports/ExportToExcelFull.tsx`**
- Dodać helper `getAmountInPLN`
- Zmodyfikować przetwarzanie transakcji w liniach 121, 145 aby przeliczać kwoty
- Zmodyfikować przetwarzanie sald otwarcia (linie 83-92) - to również wymaga przeliczenia!

---

## Problem 2: Różne formaty Excel dla domów i parafii (WYSOKI)

### Analiza obrazków

**DOM (kategoria 2-*) - Strona 1:**
```text
A. Stan finansowy
B. Intencje  
C. Należności i zobowiązania

(domy)                    Świadczenia na prowincję
(obroty MA 200-2-x-2)    kontrybucje           [kwota]
(obroty MA 200-2-x-3)    duszp. OMI             [kwota]
                         ZUS OMI                [kwota]
                         III filar              [kwota]
                         dzierżawa przech.      [kwota]
                         zast. zagraniczne      [kwota]
                         rekolekcjonista        [kwota]
                         binacje                [kwota]
                         kalendarze             [kwota]
                         podatek sąnkt.         [kwota]
(obroty MA 200-2-x-12)   pensje opodatk.        [kwota]

Przyjęto na radzie domowej dnia ............................. r.

SUPERIOR    EKONOM    PROBOSZCZ    RADNI
```

**PARAFIA (kategoria 3-*) - Strona 1:**
```text
A. Stan finansowy
B. Intencje
C. Należności i zobowiązania

[BRAK sekcji Świadczenia na prowincję]

Sporządzono dnia .............................. r.

SUPERIOR    EKONOM    PROBOSZCZ
```

### Rozwiązanie

W `ExportToExcelFull.tsx` wykryć typ lokalizacji i wygenerować odpowiedni format:

```typescript
const handleExport = async () => {
  // Pobierz location_identifier
  const { data: locationData } = await supabase
    .from('locations')
    .select('*, location_identifier')
    .eq('id', location_id)
    .single();

  // Wykryj typ lokalizacji
  const locationType = locationData?.location_identifier?.startsWith('2') ? 'dom' : 'parafia';
  
  // ... generowanie arkusza 1 ...
  
  // Sekcja Świadczenia na prowincję - TYLKO dla domów
  if (locationType === 'dom') {
    const locationIdentifier = locationData.location_identifier;
    
    sheet1Data.push(['']);
    sheet1Data.push(['(domy)', null, 'Świadczenia na prowincję']);
    
    // Obroty MA 200-2-x-2 - kontrybucje
    const contributions = liabilitiesMap.get('200')?.liabilities || 0; // uproszczenie
    sheet1Data.push([`(obroty MA 200-${locationIdentifier}-2)`, 'kontrybucje', contributions]);
    
    // Obroty MA 200-2-x-3 - duszp. OMI i inne
    sheet1Data.push([`(obroty MA 200-${locationIdentifier}-3)`, 'duszp. OMI', /* kwota */]);
    sheet1Data.push(['', 'ZUS OMI', /* kwota */]);
    sheet1Data.push(['', 'III filar', /* kwota */]);
    // ... pozostałe pozycje
    
    // Podpisy dla domu
    sheet1Data.push([`Przyjęto na radzie domowej dnia ................${year} r.`]);
    sheet1Data.push(['']);
    sheet1Data.push(['SUPERIOR', 'EKONOM', 'PROBOSZCZ', 'RADNI']);
  } else {
    // Podpisy dla parafii (bez RADNI)
    sheet1Data.push([`Sporządzono dnia ................${year} r.`]);
    sheet1Data.push(['']);
    sheet1Data.push(['SUPERIOR', 'EKONOM', 'PROBOSZCZ']);
  }
};
```

### Uwaga - sekcja "Świadczenia na prowincję"

Na obrazku widać konta:
- `200-2-x-2` (kontrybucje)
- `200-2-x-3` (duszp. OMI, ZUS OMI, III filar, dzierżawa przech., zast. zagraniczne, rekolekcjonista, binacje, kalendarze, podatek sąnkt.)
- `200-2-x-12` (pensje opodatk.)

Gdzie `x` to numer lokalizacji (np. dla `2-3` byłoby `200-2-3-2`, `200-2-3-3`, itd.)

Muszę zmodyfikować logikę aby:
1. Pobrać obroty Ma dla kont `200-{location_identifier}-*`
2. Rozbić je na poszczególne kategorie (2, 3, 12)

---

## Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `src/components/reports/ReportViewFull.tsx` | Dodać przeliczanie walut na PLN |
| `src/components/reports/ExportToExcelFull.tsx` | Dodać przeliczanie walut + różne formaty dla dom/parafia |

---

## Techniczne szczegóły implementacji

### 1. Przeliczanie walut w raportach

```typescript
// src/components/reports/ReportViewFull.tsx i ExportToExcelFull.tsx

// Helper do przeliczania na PLN
const getAmountInPLN = (amount: number, currency?: string, exchangeRate?: number): number => {
  if (!currency || currency === 'PLN' || !exchangeRate) return amount;
  return amount * exchangeRate;
};

// W przetwarzaniu transakcji:
transactions?.forEach(tx => {
  const exchangeRate = tx.exchange_rate || 1;
  const currency = tx.currency || 'PLN';
  
  if (tx.credit_account) {
    const rawAmount = tx.credit_amount || tx.amount || 0;
    const amount = getAmountInPLN(rawAmount, currency, exchangeRate);
    // ... dalej bez zmian
  }
  
  if (tx.debit_account) {
    const rawAmount = tx.debit_amount || tx.amount || 0;
    const amount = getAmountInPLN(rawAmount, currency, exchangeRate);
    // ... dalej bez zmian
  }
});
```

### 2. Saldo otwarcia również wymaga przeliczenia

```typescript
// W ExportToExcelFull.tsx - pobieranie sald otwarcia
const { data: prevTransactions } = await supabase
  .from('transactions')
  .select(`
    debit_amount, credit_amount, currency, exchange_rate,
    debit_account:accounts!transactions_debit_account_id_fkey(number),
    credit_account:accounts!transactions_credit_account_id_fkey(number)
  `)
  .eq('location_id', location_id)
  .lte('date', prevMonthEndStr);

// Oblicz salda otwarcia Z PRZELICZENIEM
prevTransactions?.forEach(tx => {
  const rate = tx.exchange_rate || 1;
  const curr = tx.currency || 'PLN';
  
  if (tx.debit_account?.number) {
    const prefix = tx.debit_account.number.split('-')[0];
    const amount = getAmountInPLN(tx.debit_amount || 0, curr, rate);
    openingBalances.set(prefix, (openingBalances.get(prefix) || 0) + amount);
  }
  // ... analogicznie dla credit
});
```

### 3. Wykrywanie typu lokalizacji i formatowanie Excel

```typescript
// W ExportToExcelFull.tsx

// Na początku handleExport:
const { data: locationData } = await supabase
  .from('locations')
  .select('*, location_identifier')
  .eq('id', location_id)
  .single();

const isDom = locationData?.location_identifier?.startsWith('2');
const isParafia = locationData?.location_identifier?.startsWith('3');

// ... budowanie arkusza 1 ...

// Po sekcji C. Należności i zobowiązania:
if (isDom) {
  // Sekcja "Świadczenia na prowincję" - TYLKO dla domów
  sheet1Data.push(['']);
  sheet1Data.push(['(domy)', null, 'Świadczenia na prowincję']);
  
  // Pobierz obroty MA dla kont 200-{location_identifier}-*
  // ... szczegółowa implementacja
  
  sheet1Data.push([`Przyjęto na radzie domowej dnia ................${year} r.`]);
  sheet1Data.push(['']);
  sheet1Data.push(['SUPERIOR', 'EKONOM', 'PROBOSZCZ', 'RADNI']);
} else if (isParafia) {
  sheet1Data.push([`Sporządzono dnia ................${year} r.`]);
  sheet1Data.push(['']);
  sheet1Data.push(['SUPERIOR', 'EKONOM', 'PROBOSZCZ']);
}
```

---

## Kolejność implementacji

1. **KRYTYCZNE (natychmiast):**
   - Problem 1: Przeliczanie walut na PLN w obu plikach

2. **WYSOKI (szybko):**
   - Problem 2: Różne formaty Excel dla domów i parafii

---

## Szacowany czas realizacji

| Zadanie | Czas |
|---------|------|
| Przeliczanie walut w ReportViewFull.tsx | 0.5h |
| Przeliczanie walut w ExportToExcelFull.tsx | 0.5h |
| Różne formaty Excel (dom vs parafia) | 2h |
| Testowanie | 0.5h |
| **RAZEM** | **~3.5 godziny** |

---

## Diagram przepływu - przeliczanie walut

```text
PRZED NAPRAWĄ:
┌─────────────────────────────────────────┐
│ Transakcja: 1000 EUR, kurs 4.20         │
│ tx.credit_amount = 1000                 │
│ tx.currency = 'EUR'                     │
│ tx.exchange_rate = 4.20                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ OBECNY KOD (błędny):                    │
│ amount = tx.credit_amount = 1000        │
│ incomeMap.set('710', 1000)              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ RAPORT pokazuje: 1 000 zł ❌            │
└─────────────────────────────────────────┘

PO NAPRAWIE:
┌─────────────────────────────────────────┐
│ Transakcja: 1000 EUR, kurs 4.20         │
│ tx.credit_amount = 1000                 │
│ tx.currency = 'EUR'                     │
│ tx.exchange_rate = 4.20                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ NOWY KOD (poprawny):                    │
│ rawAmount = 1000                        │
│ amount = getAmountInPLN(1000, 'EUR',    │
│          4.20) = 4200                   │
│ incomeMap.set('710', 4200)              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ RAPORT pokazuje: 4 200 zł ✓             │
└─────────────────────────────────────────┘
```

