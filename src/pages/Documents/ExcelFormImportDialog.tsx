import React, { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';

// Struktura sparsowanych danych z formularza Excel
interface ExcelFormData {
  fullName: string;
  locationName: string;
  locationCode: string;
  paymentType: 'gotowka' | 'bank';
  cashAccountNumber: string;
  month: number;
  year: number;
  incomeItems: FormItem[];
  expenseItems: FormItem[];
}

interface FormItem {
  baseAccountNumber: string;
  description: string;
  amount: number;
}

// Transakcja do wygenerowania
interface GeneratedTransaction {
  description: string;
  debitAmount: number;
  debitAccountNumber: string;
  debitAccountId: string | null;
  creditAmount: number;
  creditAccountNumber: string;
  creditAccountId: string | null;
  type: 'income' | 'expense';
  hasError: boolean;
  errorMessage?: string;
}

interface ExcelFormImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

const ExcelFormImportDialog: React.FC<ExcelFormImportDialogProps> = ({ 
  open, 
  onClose, 
  onImportComplete 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ExcelFormData | null>(null);
  const [generatedTransactions, setGeneratedTransactions] = useState<GeneratedTransaction[]>([]);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());
  const [parseError, setParseError] = useState<string | null>(null);
  
  const { data: accounts = [] } = useFilteredAccounts();
  const { user } = useAuth();
  const { toast } = useToast();

  // Mapa kont dla szybkiego wyszukiwania
  const accountsMap = useMemo(() => {
    const map = new Map<string, FilteredAccount>();
    accounts.forEach(acc => {
      map.set(acc.number, acc);
    });
    return map;
  }, [accounts]);

  // Znajdź konto po numerze
  const findAccount = (accountNumber: string): FilteredAccount | undefined => {
    // Dokładne dopasowanie
    if (accountsMap.has(accountNumber)) {
      return accountsMap.get(accountNumber);
    }
    
    // Szukaj częściowego dopasowania (prefix)
    for (const [number, account] of accountsMap) {
      if (number.startsWith(accountNumber) || accountNumber.startsWith(number)) {
        return account;
      }
    }
    
    return undefined;
  };

  // Parsowanie pliku Excel
  const parseExcelFile = async (file: File): Promise<ExcelFormData> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    // Pobierz pierwszy arkusz
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Konwertuj do JSON (z zachowaniem pozycji komórek)
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    
    console.log('Parsed Excel data:', data);
    
    // Parsowanie nagłówka formularza
    // Struktura formularza (na podstawie obrazka):
    // Wiersz 2-3: Imię i Nazwisko, Placówka
    // Wiersz 4: Gotówka/Bank, Numer konta
    // Wiersz 5: Miesiąc, Rok
    // Wiersze od ~7: Pozycje przychodowe i rozchodowe
    
    let fullName = '';
    let locationName = '';
    let locationCode = '';
    let paymentType: 'gotowka' | 'bank' = 'gotowka';
    let cashAccountNumber = '';
    let month = new Date().getMonth() + 1;
    let year = new Date().getFullYear();
    
    // Szukamy kluczowych danych w nagłówku
    for (let rowIdx = 0; rowIdx < Math.min(10, data.length); rowIdx++) {
      const row = data[rowIdx];
      if (!row) continue;
      
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = String(row[colIdx] || '').toLowerCase().trim();
        const nextCell = row[colIdx + 1] ? String(row[colIdx + 1]).trim() : '';
        
        // Szukaj placówki/lokalizacji
        if (cell.includes('placówka') || cell.includes('lokalizacja') || cell.includes('dom')) {
          locationName = nextCell || String(row[colIdx + 2] || '').trim();
        }
        
        // Szukaj kodu lokalizacji (format np. "2-17", "2-1")
        if (cell.includes('kod') || (nextCell && /^\d+-\d+(-\d+)?$/.test(nextCell))) {
          const match = String(row[colIdx + 1] || row[colIdx + 2] || '').match(/(\d+-\d+(-\d+)?)/);
          if (match) {
            locationCode = match[1];
          }
        }
        
        // Szukaj typu płatności
        if (cell.includes('gotówka') || cell.includes('gotowka')) {
          paymentType = 'gotowka';
        } else if (cell.includes('bank') || cell.includes('rachunek')) {
          paymentType = 'bank';
        }
        
        // Szukaj numeru konta kasowego (format 100-X-X-X lub 130-X-X-X)
        const accountMatch = String(row[colIdx] || '').match(/^(100|130)-\d+-\d+(-\d+)?$/);
        if (accountMatch) {
          cashAccountNumber = row[colIdx];
        }
        
        // Szukaj miesiąca i roku
        if (cell.includes('miesiąc') || cell.includes('miesiac')) {
          const monthVal = parseInt(nextCell);
          if (monthVal >= 1 && monthVal <= 12) month = monthVal;
        }
        if (cell.includes('rok') && !cell.includes('dochod')) {
          const yearVal = parseInt(nextCell);
          if (yearVal >= 2000 && yearVal <= 2100) year = yearVal;
        }
        
        // Szukaj imienia
        if (cell.includes('imię') || cell.includes('imie') || cell.includes('nazwisko')) {
          fullName = nextCell;
        }
      }
    }
    
    // Jeśli nie znaleziono kodu lokalizacji, spróbuj wyciągnąć z numeru konta
    if (!locationCode && cashAccountNumber) {
      const parts = cashAccountNumber.split('-');
      if (parts.length >= 3) {
        locationCode = `${parts[1]}-${parts[2]}`;
      }
    }
    
    // Parsowanie pozycji przychodowych i rozchodowych
    const incomeItems: FormItem[] = [];
    const expenseItems: FormItem[] = [];
    
    // Szukamy wierszy z numerami kont (zaczynających się od cyfry)
    let inIncomeSection = false;
    let inExpenseSection = false;
    
    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      if (!row) continue;
      
      // Sprawdź nagłówki sekcji
      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('przychod') || rowText.includes('dochod') || rowText.includes('wpływ')) {
        inIncomeSection = true;
        inExpenseSection = false;
        continue;
      }
      if (rowText.includes('rozchod') || rowText.includes('wydatek') || rowText.includes('koszty')) {
        inIncomeSection = false;
        inExpenseSection = true;
        continue;
      }
      
      // Szukaj pozycji z numerami kont i kwotami
      // Format: Numer konta | Opis | Kwota
      // lub: Numer konta | Opis | Kwota (przychody) | Numer konta | Opis | Kwota (rozchody)
      
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = String(row[colIdx] || '').trim();
        
        // Sprawdź czy to numer konta (3-cyfrowy prefix konta)
        const accountMatch = cell.match(/^(\d{3})$/);
        if (accountMatch) {
          const baseAccountNumber = accountMatch[1];
          
          // Szukaj opisu i kwoty w kolejnych kolumnach
          let description = '';
          let amount = 0;
          
          for (let searchIdx = colIdx + 1; searchIdx < Math.min(colIdx + 5, row.length); searchIdx++) {
            const searchCell = row[searchIdx];
            if (searchCell === undefined || searchCell === null || searchCell === '') continue;
            
            const searchStr = String(searchCell).trim();
            
            // Sprawdź czy to kwota (liczba z separatorem)
            const amountMatch = searchStr.replace(/\s/g, '').match(/^[\d\s.,]+$/);
            if (amountMatch) {
              const cleanAmount = searchStr
                .replace(/\s/g, '')
                .replace(/\./g, '')  // Usuń kropki (separator tysięcy)
                .replace(',', '.');   // Zamień przecinek na kropkę
              amount = parseFloat(cleanAmount) || 0;
            } else if (!description && searchStr.length > 1 && !/^\d+$/.test(searchStr)) {
              // To opis (tekst, nie sama liczba)
              description = searchStr;
            }
          }
          
          // Dodaj pozycję jeśli ma kwotę
          if (amount > 0) {
            const item: FormItem = {
              baseAccountNumber,
              description: description || `Konto ${baseAccountNumber}`,
              amount
            };
            
            // Określ typ na podstawie numeru konta lub sekcji
            const accountPrefix = parseInt(baseAccountNumber.charAt(0));
            
            // Konta 7xx, 2xx, 1xx (oprócz 100) to przychody
            // Konta 4xx to koszty
            if (accountPrefix === 7 || accountPrefix === 2 || (accountPrefix === 1 && baseAccountNumber !== '100')) {
              incomeItems.push(item);
            } else if (accountPrefix === 4) {
              expenseItems.push(item);
            } else if (inIncomeSection) {
              incomeItems.push(item);
            } else if (inExpenseSection) {
              expenseItems.push(item);
            }
          }
        }
      }
    }
    
    // Jeśli nie wykryto pozycji, spróbuj parsować całą tabelę
    if (incomeItems.length === 0 && expenseItems.length === 0) {
      // Alternatywne parsowanie - szukamy dowolnych wierszy z formatem konto-kwota
      for (let rowIdx = 5; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row || row.length < 2) continue;
        
        // Sprawdź każdą komórkę
        for (let colIdx = 0; colIdx < row.length - 1; colIdx++) {
          const cell = String(row[colIdx] || '').trim();
          
          // Szukaj pełnych numerów kont (np. 711-2-1, 401-2-17)
          const fullAccountMatch = cell.match(/^(\d{3})-(\d+)-(\d+)(-\d+)?$/);
          if (fullAccountMatch) {
            const baseAccountNumber = fullAccountMatch[1];
            
            // Szukaj kwoty w sąsiednich komórkach
            for (let searchIdx = colIdx + 1; searchIdx < Math.min(colIdx + 4, row.length); searchIdx++) {
              const searchCell = row[searchIdx];
              if (!searchCell) continue;
              
              const searchStr = String(searchCell).trim().replace(/\s/g, '');
              const amountMatch = searchStr.match(/^[\d.,]+$/);
              
              if (amountMatch) {
                const cleanAmount = searchStr
                  .replace(/\./g, '')
                  .replace(',', '.');
                const amount = parseFloat(cleanAmount) || 0;
                
                if (amount > 0) {
                  const item: FormItem = {
                    baseAccountNumber,
                    description: `Konto ${cell}`,
                    amount
                  };
                  
                  const accountPrefix = parseInt(baseAccountNumber.charAt(0));
                  if (accountPrefix === 7 || accountPrefix === 2) {
                    incomeItems.push(item);
                  } else if (accountPrefix === 4) {
                    expenseItems.push(item);
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    console.log('Parsed form data:', {
      fullName,
      locationName,
      locationCode,
      paymentType,
      cashAccountNumber,
      month,
      year,
      incomeItems,
      expenseItems
    });
    
    return {
      fullName,
      locationName,
      locationCode,
      paymentType,
      cashAccountNumber,
      month,
      year,
      incomeItems,
      expenseItems
    };
  };

  // Generowanie transakcji na podstawie sparsowanych danych
  const generateTransactions = (data: ExcelFormData): GeneratedTransaction[] => {
    const transactions: GeneratedTransaction[] = [];
    const locationSuffix = data.locationCode;
    
    // Znajdź konto gotówki/banku
    const cashAccount = findAccount(data.cashAccountNumber);
    const cashAccountError = !cashAccount 
      ? `Nie znaleziono konta ${data.cashAccountNumber}` 
      : undefined;
    
    // Dla przychodów: Winien=gotówka/bank, Ma=przychód
    for (const income of data.incomeItems) {
      const extendedAccountNumber = locationSuffix 
        ? `${income.baseAccountNumber}-${locationSuffix}` 
        : income.baseAccountNumber;
      
      const creditAccount = findAccount(extendedAccountNumber);
      const hasError = !creditAccount || !cashAccount;
      
      transactions.push({
        description: income.description,
        debitAmount: income.amount,
        debitAccountNumber: data.cashAccountNumber,
        debitAccountId: cashAccount?.id || null,
        creditAmount: income.amount,
        creditAccountNumber: extendedAccountNumber,
        creditAccountId: creditAccount?.id || null,
        type: 'income',
        hasError,
        errorMessage: !creditAccount 
          ? `Nie znaleziono konta ${extendedAccountNumber}` 
          : cashAccountError
      });
    }
    
    // Dla rozchodów: Winien=koszt, Ma=gotówka/bank
    for (const expense of data.expenseItems) {
      const extendedAccountNumber = locationSuffix 
        ? `${expense.baseAccountNumber}-${locationSuffix}` 
        : expense.baseAccountNumber;
      
      const debitAccount = findAccount(extendedAccountNumber);
      const hasError = !debitAccount || !cashAccount;
      
      transactions.push({
        description: expense.description,
        debitAmount: expense.amount,
        debitAccountNumber: extendedAccountNumber,
        debitAccountId: debitAccount?.id || null,
        creditAmount: expense.amount,
        creditAccountNumber: data.cashAccountNumber,
        creditAccountId: cashAccount?.id || null,
        type: 'expense',
        hasError,
        errorMessage: !debitAccount 
          ? `Nie znaleziono konta ${extendedAccountNumber}` 
          : cashAccountError
      });
    }
    
    return transactions;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setParseError(null);
    setParsedData(null);
    setGeneratedTransactions([]);
    
    try {
      const data = await parseExcelFile(selectedFile);
      setParsedData(data);
      
      if (data.incomeItems.length === 0 && data.expenseItems.length === 0) {
        setParseError('Nie znaleziono żadnych pozycji przychodowych lub rozchodowych w formularzu.');
        return;
      }
      
      // Ustaw datę dokumentu na podstawie formularza
      if (data.month && data.year) {
        setDocumentDate(new Date(data.year, data.month - 1, 15));
      }
      
      // Generuj transakcje
      const transactions = generateTransactions(data);
      setGeneratedTransactions(transactions);
      
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      setParseError('Nie udało się przetworzyć pliku Excel. Upewnij się, że używasz właściwego szablonu formularza rozliczeń.');
    }
  };

  const handleImport = async () => {
    if (!parsedData || generatedTransactions.length === 0) {
      toast({
        title: "Błąd",
        description: "Brak transakcji do importu",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.location) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji użytkownika",
        variant: "destructive",
      });
      return;
    }
    
    // Filtruj tylko poprawne transakcje
    const validTransactions = generatedTransactions.filter(t => !t.hasError);
    
    if (validTransactions.length === 0) {
      toast({
        title: "Błąd",
        description: "Wszystkie transakcje zawierają błędy. Dodaj brakujące konta przed importem.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Wygeneruj numer dokumentu
      const { data: documentNumber, error: numberError } = await supabase
        .rpc('generate_document_number', {
          p_location_id: user.location,
          p_year: documentDate.getFullYear(),
          p_month: documentDate.getMonth() + 1
        });

      if (numberError) {
        console.error('Error generating document number:', numberError);
        throw numberError;
      }

      // Utwórz dokument
      const documentName = `Rozliczenie indywidualne${parsedData.locationName ? ` - ${parsedData.locationName}` : ''} - ${parsedData.month}/${parsedData.year}`;
      
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          document_number: documentNumber,
          document_name: documentName,
          document_date: documentDate.toISOString().split('T')[0],
          location_id: user.location,
          user_id: user.id,
          currency: 'PLN'
        })
        .select()
        .single();
      
      if (docError) {
        console.error('Error creating document:', docError);
        throw docError;
      }

      // Przygotuj transakcje do wstawienia
      const transactionsToInsert = validTransactions.map((t, index) => ({
        document_id: document.id,
        document_number: documentNumber,
        date: documentDate.toISOString().split('T')[0],
        description: t.description,
        debit_amount: t.debitAmount,
        credit_amount: t.creditAmount,
        debit_account_id: t.debitAccountId,
        credit_account_id: t.creditAccountId,
        currency: 'PLN',
        exchange_rate: 1,
        settlement_type: parsedData.paymentType === 'gotowka' ? 'Gotówka' : 'Bank',
        location_id: user.location,
        user_id: user.id,
        display_order: index
      }));

      // Wstaw transakcje
      const { error: transError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (transError) {
        console.error('Error inserting transactions:', transError);
        throw transError;
      }

      const errorCount = generatedTransactions.length - validTransactions.length;
      
      toast({
        title: "Sukces",
        description: `Utworzono dokument ${documentNumber} z ${validTransactions.length} operacjami.${errorCount > 0 ? ` (${errorCount} pominięto z powodu błędów)` : ''}`,
      });

      onImportComplete(1);
      handleClose();

    } catch (error) {
      console.error('Error importing Excel form:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas importu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setGeneratedTransactions([]);
    setParseError(null);
    setDocumentDate(new Date());
    onClose();
  };

  const downloadTemplate = () => {
    // Generuj szablon formularza Excel
    const wb = XLSX.utils.book_new();
    
    // Dane szablonu
    const templateData = [
      ['FORMULARZ ROZLICZEŃ INDYWIDUALNYCH'],
      [],
      ['Imię i Nazwisko:', '', 'Placówka:', '', 'Kod lokalizacji:', '2-1'],
      ['Typ płatności:', 'Gotówka', 'Nr konta kasowego:', '', '100-2-1-1', ''],
      ['Miesiąc:', new Date().getMonth() + 1, '', 'Rok:', new Date().getFullYear(), ''],
      [],
      ['PRZYCHODY', '', '', '', 'ROZCHODY', '', ''],
      ['Konto', 'Opis', 'Kwota', '', 'Konto', 'Opis', 'Kwota'],
      ['149', 'Z kasy domowej', '', '', '401', 'Biurowe', ''],
      ['210', 'Intencje', '', '', '402', 'Poczta', ''],
      ['702', 'Misje', '', '', '403', 'Telefony, Internet', ''],
      ['703', 'Duszpasterstwo', '', '', '404', 'Podróże lokalne', ''],
      ['704', 'Kolęda', '', '', '405', 'Środki czystości', ''],
      ['705', 'Zastępstwa', '', '', '410', 'Żywność', ''],
      ['710', 'Odsetki', '', '', '420', 'Utrzymanie', ''],
      ['711', 'Sprzedaż kalendarzy', '', '', '421', 'Remonty', ''],
      ['714', 'Pensje', '', '', '430', 'Ubezpieczenia', ''],
      ['715', 'Zwroty', '', '', '431', 'Podatki', ''],
      ['717', 'Inne przychody', '', '', '440', 'Inne koszty', ''],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Ustaw szerokości kolumn
    ws['!cols'] = [
      { wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 4 },
      { wch: 8 }, { wch: 25 }, { wch: 12 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Rozliczenie');
    
    // Pobierz plik
    XLSX.writeFile(wb, 'szablon_rozliczen.xlsx');
    
    toast({
      title: "Szablon pobrany",
      description: "Szablon formularza rozliczeń został pobrany",
    });
  };

  const validCount = generatedTransactions.filter(t => !t.hasError).length;
  const errorCount = generatedTransactions.filter(t => t.hasError).length;
  const totalAmount = generatedTransactions.reduce((sum, t) => sum + t.debitAmount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import formularza rozliczeń Excel
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Sekcja wyboru pliku */}
          <div className="space-y-2">
            <Label htmlFor="excel-file" className="text-sm font-medium">
              Wybierz plik Excel (.xls, .xlsx)
            </Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                id="excel-file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('excel-file')?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Wybierz plik
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Pobierz szablon
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground">{file.name}</span>
              )}
            </div>
          </div>

          {/* Błąd parsowania */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Błąd parsowania</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Informacje o formularzu */}
          {parsedData && !parseError && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Placówka</Label>
                  <p className="text-sm font-medium">{parsedData.locationName || 'Nieznana'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Kod lokalizacji</Label>
                  <p className="text-sm font-medium">{parsedData.locationCode || 'Nie wykryto'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Typ płatności</Label>
                  <p className="text-sm font-medium">{parsedData.paymentType === 'gotowka' ? 'Gotówka' : 'Bank'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Konto kasowe</Label>
                  <p className="text-sm font-medium">{parsedData.cashAccountNumber || 'Nie wykryto'}</p>
                </div>
              </div>

              {/* Data dokumentu */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data dokumentu</Label>
                <DatePicker
                  value={documentDate}
                  onChange={(date) => date && setDocumentDate(date)}
                  placeholder="Wybierz datę dokumentu"
                />
              </div>

              {/* Podsumowanie */}
              <div className="flex items-center gap-4">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} poprawnych
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errorCount} z błędami
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Łączna kwota: {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(totalAmount)}
                </span>
              </div>

              {/* Podgląd transakcji */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Podgląd operacji do zaimportowania</Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-xs font-medium text-left">Typ</th>
                        <th className="px-3 py-2 text-xs font-medium text-left">Opis</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">Kwota</th>
                        <th className="px-3 py-2 text-xs font-medium text-left">Wn</th>
                        <th className="px-3 py-2 text-xs font-medium text-left">Ma</th>
                        <th className="px-3 py-2 text-xs font-medium text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {generatedTransactions.map((transaction, index) => (
                        <tr 
                          key={index} 
                          className={transaction.hasError ? 'bg-destructive/10' : 'hover:bg-muted/50'}
                        >
                          <td className="px-3 py-2 text-xs">
                            <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                              {transaction.type === 'income' ? 'Przychód' : 'Rozchód'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs max-w-[150px] truncate">
                            {transaction.description}
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-mono">
                            {new Intl.NumberFormat('pl-PL', { 
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2 
                            }).format(transaction.debitAmount)}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">
                            {transaction.debitAccountNumber}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono">
                            {transaction.creditAccountNumber}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {transaction.hasError ? (
                              <span className="text-destructive" title={transaction.errorMessage}>
                                ❌ {transaction.errorMessage}
                              </span>
                            ) : (
                              <span className="text-green-600">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={loading || !parsedData || validCount === 0}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Importowanie...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importuj {validCount} operacji
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExcelFormImportDialog;
