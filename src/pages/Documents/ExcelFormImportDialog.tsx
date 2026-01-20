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
  paymentTypeRaw: string; // E4 - oryginalna wartość typu płatności
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

  // Parsowanie pliku Excel - dostosowane do szablonu
  // Układ szablonu:
  // Wiersz 1: Informacja "Wypełniamy tylko komórki zacienione."
  // Wiersz 2: C = "Imię i Nazwisko:", E = wartość
  // Wiersz 3: C = "Placówka:", E = wartość, I = kod (np. "2-17")
  // Wiersz 4: C = "Gotówka/rachunek (podać nr)", E = typ (gotówka/bank), I = numer konta (np. "100-2-17")
  // Wiersz 5: pusty
  // Wiersz 6: A = "Miesiąc:", B = wartość, H = "Rok:", I = wartość
  // Wiersz 7: A = "PRZYCHODY", F = "ROZCHODY"
  // Wiersz 8: Nagłówki - LP, Konto, Opis, '', Kwota, LP, Konto, Opis, Kwota
  // Wiersz 9+: Dane - przychody w kol. A-E, rozchody w kol. F-I
  const parseExcelFile = async (file: File): Promise<ExcelFormData> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Konwertuj do tablicy 2D (wiersze x kolumny)
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    
    console.log('Parsed Excel data:', data);
    
    // Pobierz wartości z konkretnych komórek zgodnie z szablonem
    // Indeksy 0-based: wiersz 2 = index 1, kolumna E = index 4, itd.
    
    // Wiersz 2 (index 1): Imię i Nazwisko w kolumnie E (index 4) lub dalej
    const fullName = String(data[1]?.[4] || data[1]?.[3] || '').trim();
    
    // Wiersz 3 (index 2): Placówka w E (index 4), Kod lokalizacji w I (index 8)
    const locationName = String(data[2]?.[4] || data[2]?.[3] || '').trim();
    const locationCode = String(data[2]?.[8] || '').trim();
    
    // Wiersz 4 (index 3): Typ płatności w E (index 4), Numer konta w I (index 8)
    const paymentTypeRawValue = String(data[3]?.[4] || '').trim();
    const paymentTypeLower = paymentTypeRawValue.toLowerCase();
    const paymentType: 'gotowka' | 'bank' = 
      paymentTypeLower.includes('bank') || paymentTypeLower.includes('rachunek') ? 'bank' : 'gotowka';
    const cashAccountNumber = String(data[3]?.[8] || '').trim();
    
    // Wiersz 6 (index 5): Miesiąc w B (index 1), Rok w I (index 8)
    const monthRaw = data[5]?.[1] || data[5]?.[2];
    const yearRaw = data[5]?.[8];
    
    let month = parseInt(String(monthRaw)) || new Date().getMonth() + 1;
    let year = parseInt(String(yearRaw)) || new Date().getFullYear();
    
    // Walidacja
    if (month < 1 || month > 12) month = new Date().getMonth() + 1;
    if (year < 2000 || year > 2100) year = new Date().getFullYear();
    
    console.log('Parsed header:', { fullName, locationName, locationCode, paymentType, cashAccountNumber, month, year });
    
    // Parsowanie pozycji przychodowych i rozchodowych
    // Zaczynamy od wiersza 9 (index 8)
    const incomeItems: FormItem[] = [];
    const expenseItems: FormItem[] = [];
    
    for (let rowIdx = 8; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      if (!row) continue;
      
      // PRZYCHODY: kolumny A-E (index 0-4)
      // A = LP, B = Konto, C = Opis, D = dodatkowy opis, E = Kwota
      const incomeAccount = String(row[1] || '').trim();
      const incomeDescC = String(row[2] || '').trim();
      const incomeDescD = String(row[3] || '').trim();
      // Połącz C i D jeśli D nie jest puste
      const incomeDesc = incomeDescD ? `${incomeDescC} ${incomeDescD}`.trim() : incomeDescC;
      const incomeAmountRaw = row[4];
      
      if (incomeAccount && /^\d{3}$/.test(incomeAccount)) {
        const amount = parseAmount(incomeAmountRaw);
        if (amount > 0) {
          incomeItems.push({
            baseAccountNumber: incomeAccount,
            description: incomeDesc || `Konto ${incomeAccount}`,
            amount
          });
        }
      }
      
      // ROZCHODY: kolumny F-I (index 5-8)
      // F = LP, G = Konto, H = Opis, I = Kwota
      const expenseAccount = String(row[6] || '').trim();
      const expenseDesc = String(row[7] || '').trim();
      const expenseAmountRaw = row[8];
      
      if (expenseAccount && /^\d{3}$/.test(expenseAccount)) {
        const amount = parseAmount(expenseAmountRaw);
        if (amount > 0) {
          expenseItems.push({
            baseAccountNumber: expenseAccount,
            description: expenseDesc || `Konto ${expenseAccount}`,
            amount
          });
        }
      }
    }
    
    console.log('Parsed items:', { incomeItems, expenseItems });
    
    return {
      fullName,
      locationName,
      locationCode,
      paymentType,
      paymentTypeRaw: paymentTypeRawValue,
      cashAccountNumber,
      month,
      year,
      incomeItems,
      expenseItems
    };
  };
  
  // Pomocnicza funkcja do parsowania kwot
  const parseAmount = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    
    const str = String(value).trim().replace(/\s/g, '');
    // Obsługa formatu polskiego: 1 234,56 lub 1.234,56
    const cleaned = str
      .replace(/\./g, '')  // Usuń kropki (separator tysięcy)
      .replace(',', '.');   // Zamień przecinek na kropkę (separator dziesiętny)
    
    return parseFloat(cleaned) || 0;
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

  // Sprawdź czy są błędy kont - blokada importu
  const hasAccountErrors = generatedTransactions.some(t => t.hasError);
  const missingAccounts = useMemo(() => {
    const missing = new Set<string>();
    generatedTransactions.forEach(t => {
      if (t.hasError && t.errorMessage) {
        // Wyciągnij numer konta z komunikatu błędu
        const match = t.errorMessage.match(/Nie znaleziono konta (.+)/);
        if (match) {
          missing.add(match[1]);
        }
      }
    });
    return Array.from(missing);
  }, [generatedTransactions]);

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
    
    // BLOKADA: Nie pozwól na import jeśli są brakujące konta
    if (hasAccountErrors) {
      toast({
        title: "Błąd importu",
        description: `Nie można zaimportować pliku. Brakujące konta: ${missingAccounts.join(', ')}`,
        variant: "destructive",
      });
      return;
    }
    
    const validTransactions = generatedTransactions;
    
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

      // Utwórz dokument - format: "Rozliczenie: (E3)-(E2)-(E4)"
      const documentName = `Rozliczenie: ${parsedData.locationName || 'Nieznana lokalizacja'}-${parsedData.fullName || 'Nieznany'}-${parsedData.paymentTypeRaw || 'Brak typu'}`;
      
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

  const downloadTemplate = async () => {
    console.log('=== POBIERANIE SZABLONU Z SUPABASE STORAGE ===');
    console.log('Bucket: Document, Plik: 1.xlsx');
    try {
      // Pobierz plik z Supabase Storage (bucket: Document, plik: 1.xlsx)
      const { data, error } = await supabase.storage
        .from('Document')
        .download('1.xlsx');
      
      console.log('Odpowiedź z storage:', { data, error });
      
      if (error) {
        throw error;
      }
      
      // Utwórz link do pobrania
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'szablon_rozliczen.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Szablon pobrany",
        description: "Szablon formularza rozliczeń został pobrany",
      });
    } catch (error) {
      console.error('Błąd pobierania szablonu:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać szablonu. Sprawdź czy plik istnieje w storage.",
        variant: "destructive",
      });
    }
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

              {/* Alert o brakujących kontach - blokada importu */}
              {hasAccountErrors && missingAccounts.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import zablokowany - brakujące konta</AlertTitle>
                  <AlertDescription>
                    Nie można zaimportować pliku. Następujące konta nie istnieją w systemie:
                    <div className="mt-2 flex flex-wrap gap-1">
                      {missingAccounts.map((account, idx) => (
                        <Badge key={idx} variant="outline" className="font-mono">
                          {account}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-sm">
                      Dodaj brakujące konta w module Administracja → Konta, lub popraw numery kont w pliku Excel.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

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
            disabled={loading || !parsedData || generatedTransactions.length === 0 || hasAccountErrors}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Importowanie...
              </>
            ) : hasAccountErrors ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Brakujące konta
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importuj {generatedTransactions.length} operacji
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExcelFormImportDialog;
