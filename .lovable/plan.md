
# Plan wdrożenia 10 krytycznych poprawek systemu

## Podsumowanie zadań

| # | Opis zadania | Priorytet | Główne pliki |
|---|--------------|-----------|--------------|
| 1 | Pogrubienia nagłówków w Excel | Niski | `ExportToExcelFull.tsx` |
| 2 | Widoczność konta 217 w podglądzie raportu (etap pierwszy) | Średni | `ReportForm.tsx`, `YearToDateCashFlowBreakdown.tsx` |
| 3 | Zamiana opisów Intencje przyjęte/odprawione | Średni | `ReportIntentionsTable.tsx`, `ExportToExcelFull.tsx` |
| 4 | Paginacja listy dokumentów dla admina | Wysoki | `DocumentsPage.tsx` |
| 5 | Logistyka szablonów importu CSV | Średni | `CsvImportDialog.tsx` |
| 6 | Precyzyjne komunikaty błędów przy imporcie CSV | Średni | `CsvImportDialog.tsx` |
| 7 | Import budżetu z pliku Excel | Wysoki | `BudgetPage.tsx`, nowy `BudgetImportDialog.tsx` |
| 8 | Odblokowanie dat przyszłych w kalendarzu dokumentów | Niski | `DocumentDialog.tsx`, `DatePicker.tsx` |
| 9 | Lista wyboru kont - pokazywać pod polem | Średni | `AccountCombobox.tsx` |
| 10 | Blokada usuwania dokumentów ze złożonymi raportami | Wysoki | `DocumentsPage.tsx` |

---

## 1. Pogrubienia nagłówków w wydruku Excel

### Problem
Nagłówki sekcji w arkuszach Excel nie są pogrubione (SPRAWOZDANIE MIESIĘCZNE, A. Stan finansowy, B. Intencje, C. Należności, Świadczenia, I. PRZYCHODY, II. ROZCHODY, RAZEM).

### Rozwiązanie
W `ExportToExcelFull.tsx` komórki z tymi nagłówkami już mają ustawiony obiekt stylów `{ v: ..., s: { font: { bold: true } } }`, ale biblioteka XLSX wymaga dodatkowej konfiguracji aby style były eksportowane.

Zmienić metodę zapisu na `bookType: 'xlsx'` z opcją `cellStyles: true`:
```typescript
XLSX.writeFile(wb, fileName, { bookType: 'xlsx', cellStyles: true });
```

Alternatywnie, ponieważ XLSX community edition nie wspiera w pełni stylów, należy:
1. Użyć biblioteki `xlsx-js-style` (fork z pełnym wsparciem stylów)
2. Lub oznaczyć nagłówki prefixem (np. "**A. Stan finansowy domu**") jako workaround

### Pliki do modyfikacji
- `src/components/reports/ExportToExcelFull.tsx`

---

## 2. Widoczność konta 217 (Rozliczenia z innymi) w podglądzie raportu

### Problem
Na etapie tworzenia raportu w bloku C. Należności i zobowiązania nie pokazuje się konto 217-x-x-x (Rozliczenia z innymi), mimo że po utworzeniu raportu dane te są widoczne.

### Analiza
W `ReportLiabilitiesTable.tsx` (linia 22) kategoria 217 jest zdefiniowana:
```typescript
{ key: 'others', name: '4. Rozliczenia z innymi', accounts: ['217'] }
```

Problem jest w `ReportForm.tsx` lub `YearToDateCashFlowBreakdown.tsx` - dane dla konta 217 nie są pobierane lub agregowane w podglądzie.

### Rozwiązanie
1. Sprawdzić `YearToDateCashFlowBreakdown.tsx` czy agreguje obroty dla kont 217-x-x-x
2. Dodać prefiks '217' do listy kont w sekcji należności/zobowiązań w podglądzie
3. Upewnić się że dane dla 217 są przekazywane do `ReportLiabilitiesTable`

### Pliki do modyfikacji
- `src/pages/Reports/ReportForm.tsx`
- `src/components/reports/YearToDateCashFlowBreakdown.tsx`

---

## 3. Zamiana opisów Intencje przyjęte/odprawione

### Problem
W bloku B. Intencje kolumny są opisane w złej kolejności. Powinno być:
- Saldo początkowe | Intencje przyjęte | Intencje odprawione/przekazane | Saldo końcowe

### Analiza kodu
W `ReportIntentionsTable.tsx` (linie 37-40):
```typescript
<TableHead>Odprawione i oddane</TableHead>
<TableHead>Przyjęte</TableHead>
```

Oraz w `ExportToExcelFull.tsx` (linia 296):
```typescript
sheet1Data.push(["", "Początek miesiąca", "Odprawione i oddane", "Przyjęte", "Stan końcowy"]);
```

Kolejność kolumn jest błędna - powinno być najpierw "Przyjęte" a potem "Odprawione i oddane".

### Rozwiązanie
Zamienić kolejność nagłówków i wartości:
```typescript
// ReportIntentionsTable.tsx
<TableHead>Przyjęte</TableHead>
<TableHead>Odprawione i oddane</TableHead>

// ExportToExcelFull.tsx  
sheet1Data.push(["", "Początek miesiąca", "Przyjęte", "Odprawione i oddane", "Stan końcowy"]);
sheet1Data.push([
  "1. Intencje",
  intentionsOpening,
  intentions210Received,  // najpierw przyjęte
  intentions210CelebratedGiven, // potem odprawione
  intentionsClosing,
]);
```

### Pliki do modyfikacji
- `src/components/reports/ReportIntentionsTable.tsx`
- `src/components/reports/ExportToExcelFull.tsx`

---

## 4. Paginacja listy dokumentów dla admina

### Problem
Dla admina lista dokumentów ładuje się bardzo długo, bo pobiera wszystkie dokumenty naraz bez paginacji.

### Analiza
W `DocumentsPage.tsx` (linie 79-157) zapytanie pobiera wszystkie dokumenty bez limitu, a potem dla każdego wykonuje dodatkowe zapytania o transakcje (N+1 problem).

### Rozwiązanie
1. Dodać paginację server-side z `useState` dla `page` i `pageSize`
2. Użyć `.range(start, end)` w zapytaniu Supabase
3. Dodać komponent `Pagination` z `src/components/ui/pagination.tsx`
4. Dla admina ograniczyć początkowe ładowanie do np. 50 dokumentów
5. Zoptymalizować zapytania - użyć agregacji SQL zamiast N+1

```typescript
const [currentPage, setCurrentPage] = useState(1);
const pageSize = 50;

const { data: documents } = useQuery({
  queryKey: ['documents', currentPage, pageSize],
  queryFn: async () => {
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, count } = await supabase
      .from('documents')
      .select('*, locations(name), profiles!documents_user_id_fkey(name)', { count: 'exact' })
      .order('document_date', { ascending: false })
      .range(from, to);
    
    return { documents: data, totalCount: count };
  }
});
```

### Pliki do modyfikacji
- `src/pages/Documents/DocumentsPage.tsx`

---

## 5. Logistyka szablonów importu CSV

### Problem
Szablony importu CSV używają kont syntetycznych (np. 420, 100), na które nie można księgować kwot z powodu blokady.

### Analiza
System wymaga kont analitycznych (np. 420-1-1-1) dla księgowania, ale szablon CSV zawiera tylko konta syntetyczne.

### Rozwiązanie
1. Zaktualizować szablon CSV aby używał pełnych numerów kont analitycznych z lokalizacją
2. Dodać logikę automatycznego mapowania konta syntetycznego na analityczne:
   - Jeśli użytkownik poda konto syntetyczne (np. 420), system spróbuje znaleźć odpowiednie konto analityczne dla lokalizacji
   - Np. dla lokalizacji 2-3 konto 420 → 420-2-3 lub 420-2-3-1
3. Wyświetlić ostrzeżenie gdy import nie może znaleźć pasującego konta

```typescript
const findAnalyticalAccount = (syntheticNumber: string, locationId: string): string | null => {
  // Znajdź konta zaczynające się od syntheticNumber dla danej lokalizacji
  const matching = accounts.filter(acc => 
    acc.number.startsWith(syntheticNumber + '-') && 
    acc.number.includes(locationIdentifier)
  );
  return matching.length === 1 ? matching[0].id : null;
};
```

### Pliki do modyfikacji
- `src/pages/Documents/CsvImportDialog.tsx`
- Zaktualizować szablon w `downloadCsvTemplate()`

---

## 6. Precyzyjne komunikaty błędów przy imporcie CSV

### Problem
Komunikaty błędów przy imporcie są nieprecyzyjne:
- "Nie widzi kont" zamiast "Raport blokuje import"
- Brak informacji o brakujących kontach
- Brak informacji o kontach syntetycznych

### Rozwiązanie
Dodać szczegółową walidację przed importem:

```typescript
// Sprawdź czy raport blokuje import
const { data: blockingReport } = await supabase.rpc('check_report_editing_blocked', {
  p_location_id: user.location,
  p_document_date: documentDate.toISOString().split('T')[0]
});

if (blockingReport) {
  toast({
    title: "Import zablokowany",
    description: "Nie można zaimportować pliku - raport za ten okres jest już złożony lub zatwierdzony.",
    variant: "destructive"
  });
  return;
}

// Walidacja kont
const missingAccounts: string[] = [];
const syntheticAccounts: string[] = [];

parsedData.forEach(row => {
  const account = accounts.find(a => a.number === row.accountNumber);
  if (!account) {
    missingAccounts.push(row.accountNumber);
  } else if (account.has_analytics) {
    syntheticAccounts.push(row.accountNumber);
  }
});

if (missingAccounts.length > 0 || syntheticAccounts.length > 0) {
  let message = '';
  if (missingAccounts.length > 0) {
    message += `Brakujące konta: ${missingAccounts.join(', ')}. `;
  }
  if (syntheticAccounts.length > 0) {
    message += `Konta syntetyczne (wymagają podkont): ${syntheticAccounts.join(', ')}. `;
  }
  toast({ title: "Błąd walidacji", description: message, variant: "destructive" });
  return;
}
```

### Pliki do modyfikacji
- `src/pages/Documents/CsvImportDialog.tsx`

---

## 7. Import budżetu z pliku Excel

### Problem
Brak funkcji importu budżetu z pliku Excel.

### Rozwiązanie
1. Stworzyć nowy komponent `BudgetImportDialog.tsx`
2. Zdefiniować szablon Excel z kolumnami:
   - Nr konta | Nazwa konta | Typ (przychód/koszt) | Kwota planowana | Kwota z poprzedniego roku
3. Dodać przycisk "Import z pliku" obok "Nowy budżet" w `BudgetPage.tsx`
4. Parsować plik używając biblioteki `xlsx`
5. Mapować pozycje na `budget_items`

Szablon Excel:
```text
| Nr konta | Nazwa               | Typ      | Plan 2025 | Wykonanie 2024 |
|----------|---------------------|----------|-----------|----------------|
| 701      | Taca                | przychód | 50000     | 48000          |
| 702      | Darowizny           | przychód | 30000     | 28500          |
| 401      | Biurowe             | koszt    | 5000      | 4800           |
| 402      | Poczta              | koszt    | 2000      | 1900           |
```

### Pliki do utworzenia/modyfikacji
- Nowy: `src/pages/Budget/BudgetImportDialog.tsx`
- Modyfikacja: `src/pages/Budget/BudgetPage.tsx`

---

## 8. Odblokowanie dat przyszłych w dokumentach

### Problem
Kalendarz wyboru daty dokumentu blokuje daty przyszłe.

### Analiza
W `DatePicker.tsx` lub w `DocumentDialog.tsx` może być ustawione ograniczenie `disabled={{ after: new Date() }}`.

### Rozwiązanie
Usunąć ograniczenie dat przyszłych dla dokumentów:
```typescript
// W DocumentDialog.tsx lub DatePicker
<DatePicker
  value={documentDate}
  onChange={setDocumentDate}
  // Usuń: disabled={{ after: new Date() }}
/>
```

Jeśli ograniczenie jest w `DatePicker.tsx`, dodać props `allowFutureDates`:
```typescript
interface DatePickerProps {
  // ...
  allowFutureDates?: boolean;
}

// Wewnątrz komponentu:
const dateRestrictions = allowFutureDates ? {} : { after: new Date() };
```

### Pliki do modyfikacji
- `src/pages/Documents/DocumentDialog.tsx`
- Ewentualnie: `src/components/ui/date-picker.tsx`

---

## 9. Lista wyboru kont - pokazywać pod polem

### Problem
Lista wyboru kont w `AccountCombobox` może wykraczać poza górną krawędź ekranu, zasłaniając pole kwoty.

### Analiza
W `AccountCombobox.tsx` (linia 194) `PopoverContent` nie ma ustawionego `side`:
```typescript
<PopoverContent className="min-w-[450px] w-auto max-w-[600px] p-0">
```

### Rozwiązanie
Dodać `side="bottom"` i `align="start"` do `PopoverContent`:
```typescript
<PopoverContent 
  className="min-w-[450px] w-auto max-w-[600px] p-0"
  side="bottom"
  align="start"
  sideOffset={4}
  avoidCollisions={false}  // Wymusza wyświetlanie pod spodem
>
```

### Pliki do modyfikacji
- `src/pages/Documents/AccountCombobox.tsx`

---

## 10. Blokada usuwania dokumentów ze złożonymi raportami

### Problem
Użytkownicy mogą usuwać dokumenty, dla których istnieją już złożone raporty (status 'submitted' lub 'approved').

### Analiza
W `DocumentsPage.tsx` (linie 188-218) funkcja `handleDocumentDelete` sprawdza tylko potwierdzenie użytkownika, nie sprawdza statusu raportów.

### Rozwiązanie
Przed usunięciem sprawdzić czy istnieje raport blokujący:

```typescript
const handleDocumentDelete = async (documentId: string, documentDate: string, locationId: string) => {
  // Sprawdź czy raport blokuje usunięcie
  const { data: blockingReport } = await supabase
    .from('reports')
    .select('id, status, month, year')
    .eq('location_id', locationId)
    .eq('month', new Date(documentDate).getMonth() + 1)
    .eq('year', new Date(documentDate).getFullYear())
    .in('status', ['submitted', 'approved', 'draft'])
    .maybeSingle();

  if (blockingReport) {
    const statusMap = { draft: 'w wersji roboczej', submitted: 'złożony', approved: 'zatwierdzony' };
    toast({
      title: "Nie można usunąć dokumentu",
      description: `Raport za ${blockingReport.month}/${blockingReport.year} jest ${statusMap[blockingReport.status]}. Najpierw cofnij raport.`,
      variant: "destructive"
    });
    return;
  }

  if (!confirm('Czy na pewno chcesz usunąć ten dokument?')) return;
  
  // ... reszta logiki usuwania
};
```

Dodatkowo można ukryć przycisk usuwania dla zablokowanych dokumentów:
```typescript
// W DocumentsTable przekazać info o blokadzie
const isDeleteBlocked = blockedPeriods.has(`${doc.location_id}-${month}-${year}`);
```

### Pliki do modyfikacji
- `src/pages/Documents/DocumentsPage.tsx`
- `src/pages/Documents/DocumentsTable.tsx` (opcjonalnie - ukrycie przycisku)

---

## Kolejność wdrożenia

### Faza 1 - Krytyczne (natychmiast):
1. **#1** - Pogrubienia w Excel
2. **#2** - Widoczność konta 217
3. **#3** - Zamiana opisów Intencje (poprawność danych)

### Faza 2 - Wysoki priorytet:
4. **#6** - Precyzyjne komunikaty błędów importu
5. **#9** - Lista kont pod polem
6. **#10** - Blokada usuwania dokumentów (integralność danych)

### Faza 3 - Średni/niski priorytet:
7. **#5** - Logistyka szablonów CSV
8. **#7** - Import budżetu z Excel
9. **#8** - Odblokowanie dat przyszłych
10. **#4** - Paginacja dokumentów (wydajność)

---

## Szacowany czas realizacji

| # | Zadanie | Czas |
|---|---------|------|
| 1 | Pogrubienia Excel | 0.5h |
| 2 | Widoczność konta 217 | 1h |
| 3 | Zamiana opisów Intencje | 0.5h |
| 4 | Paginacja dokumentów | 2h |
| 5 | Logistyka szablonów CSV | 2h |
| 6 | Komunikaty błędów importu | 1h |
| 7 | Import budżetu z Excel | 4h |
| 8 | Odblokowanie dat przyszłych | 0.5h |
| 9 | Lista kont pod polem | 0.5h |
| 10 | Blokada usuwania dokumentów | 1h |
| **RAZEM** | | **~13 godzin** |

---

## Szczegóły techniczne

### Paginacja dokumentów - struktura danych
```typescript
interface PaginatedDocuments {
  documents: Document[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}
```

### Import budżetu - struktura szablonu
```typescript
interface BudgetImportRow {
  account_prefix: string;
  account_name: string;
  account_type: 'przychód' | 'koszt';
  planned_amount: number;
  previous_year_amount?: number;
  forecasted_amount?: number;
}
```

### Blokada usuwania - schemat decyzyjny
```text
Użytkownik klika "Usuń dokument"
      ↓
Sprawdź czy istnieje raport za ten okres
      ↓
[TAK, status = draft/submitted/approved]
      ↓
Wyświetl komunikat o blokadzie
      ↓
KONIEC

[NIE lub status = rejected]
      ↓
Wyświetl dialog potwierdzenia
      ↓
Usuń dokument i transakcje
```
