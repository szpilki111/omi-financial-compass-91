import React, { useState } from 'react';
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
import { Upload, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';
import Papa from 'papaparse';

// Account type is now imported from useFilteredAccounts as FilteredAccount

interface CsvTransaction {
  description: string;
  amount: string;
  accountNumber: string;
  secondAmount?: string;
  code?: string;
}

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

const CsvImportDialog: React.FC<CsvImportDialogProps> = ({ open, onClose, onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<CsvTransaction[]>([]);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());
  const { data: accounts = [] } = useFilteredAccounts();
  const [mappings, setMappings] = useState({
    descriptionColumn: '',
    amountColumn: '',
    accountColumn: '',
    secondAmountColumn: '',
    codeColumn: '',
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const findBestMatchingColumn = (columns: string[], possibleMatches: string[]): string => {
    const lowerCaseColumns = columns.map(col => col.toLowerCase());
    
    for (const match of possibleMatches) {
      const foundIndex = lowerCaseColumns.findIndex(col => col.includes(match.toLowerCase()));
      if (foundIndex !== -1) {
        return columns[foundIndex];
      }
    }
    
    return '';
  };

  // Accounts are now fetched via useFilteredAccounts hook

  // Detect and convert encoding to UTF-8
  const detectAndConvertEncoding = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Check for UTF-8 BOM
    if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      console.log('Detected UTF-8 with BOM');
      return new TextDecoder('utf-8').decode(buffer);
    }
    
    // Try UTF-8 first
    try {
      const utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      // Check if text contains typical Polish characters decoded correctly
      if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(utf8Text) || !/[�\uFFFD]/.test(utf8Text)) {
        console.log('Detected UTF-8');
        return utf8Text;
      }
    } catch {
      // UTF-8 decoding failed
    }
    
    // Try Windows-1250 (common for Polish files)
    try {
      const win1250Text = new TextDecoder('windows-1250').decode(buffer);
      console.log('Detected Windows-1250');
      return win1250Text;
    } catch {
      // Windows-1250 decoding failed
    }
    
    // Fallback to ISO-8859-2
    try {
      const isoText = new TextDecoder('iso-8859-2').decode(buffer);
      console.log('Detected ISO-8859-2');
      return isoText;
    } catch {
      // Last resort - try UTF-8 without strict mode
      console.log('Fallback to UTF-8 non-strict');
      return new TextDecoder('utf-8').decode(buffer);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Detect and convert encoding automatically
    const fileContent = await detectAndConvertEncoding(selectedFile);
    
    // Parse CSV file with converted content
    Papa.parse(fileContent, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const firstRow = results.data[0] as string[];
          
          // Utwórz nazwy kolumn na podstawie pozycji
          const columnNames = firstRow.map((_, index) => `Kolumna ${index + 1}`);
          setAvailableColumns(columnNames);
          
          // Automatyczne mapowanie na podstawie pozycji (typowy format CSV)
          const columnMapping = {
            descriptionColumn: 'Kolumna 1', // Opis
            amountColumn: 'Kolumna 2', // Kwota
            accountColumn: 'Kolumna 3', // Numer konta
            secondAmountColumn: 'Kolumna 4', // Druga kwota (opcjonalna)
            codeColumn: 'Kolumna 5', // Kod (opcjonalny)
          };
          
          setMappings(columnMapping);
          
          // Przygotuj dane do podglądu (pierwsze 5 wierszy)
          const preview = results.data.slice(0, 5).map((row: any) => ({
            description: row[0] || '',
            amount: row[1] || '',
            accountNumber: row[2] || '',
            secondAmount: row[3] || '',
            code: row[4] || '',
          }));
          
          setPreviewData(preview);
        }
      }
    });
    // Accounts are already fetched via useFilteredAccounts hook
  };

  const handleMappingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMappings(prev => ({ ...prev, [name]: value }));
  };

const parseAmount = (amountStr: string): number => {
  if (!amountStr) return 0;
  // Usuwa spacje, niełamliwe spacje i separatory tysięcy (kropki w formacie polskim)
  const cleanAmount = amountStr
    .replace(/[\s\xa0]/g, '') // Usuwa spacje
    .replace(/\./g, '')       // Usuwa kropki jako separator tysięcy (format polski: 6.020,00)
    .replace(',', '.');       // Zamienia przecinek na kropkę jako separator dziesiętny
  
  const parsed = parseFloat(cleanAmount) || 0;
  return parsed; // Zwraca kwotę w złotych
};

  const handleImport = async () => {
    if (!file || !user?.location || !documentDate) {
      toast({
        title: "Błąd",
        description: "Wypełnij wszystkie wymagane pola",
        variant: "destructive",
      });
      return;
    }
    
    // Sprawdź, czy wymagane mapowania zostały ustawione
    if (!mappings.descriptionColumn || !mappings.amountColumn || !mappings.accountColumn) {
      toast({
        title: "Błąd",
        description: "Określ mapowanie wszystkich wymaganych kolumn",
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
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          document_number: documentNumber,
          document_name: `Import CSV - ${file.name}`,
          document_date: documentDate.toISOString().split('T')[0],
          location_id: user.location,
          user_id: user.id
        })
        .select()
        .single();
      
      if (docError) {
        console.error('Error creating document:', docError);
        throw docError;
      }

      // Parsuj pełny plik CSV z prawidłowym kodowaniem (jak dla podglądu)
      const fileContent = await detectAndConvertEncoding(file);
      
      Papa.parse(fileContent, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const transactionsToImport = [];
            
            // Pobierz indeksy kolumn z mapowania
            const descColIndex = parseInt(mappings.descriptionColumn.split(' ')[1]) - 1;
            const debitAmountColIndex = parseInt(mappings.amountColumn.split(' ')[1]) - 1;
            const debitAccountColIndex = parseInt(mappings.accountColumn.split(' ')[1]) - 1;
            const creditAmountColIndex = mappings.secondAmountColumn ? 
              parseInt(mappings.secondAmountColumn.split(' ')[1]) - 1 : -1;
            const creditAccountColIndex = mappings.codeColumn ? 
              parseInt(mappings.codeColumn.split(' ')[1]) - 1 : -1;
            
            for (let rowIndex = 0; rowIndex < results.data.length; rowIndex++) {
              const row = results.data[rowIndex] as string[];
              
              const description = row[descColIndex] || '';
              const debitAmountStr = row[debitAmountColIndex] || '';
              const debitAccountNumber = row[debitAccountColIndex] || '';
              const creditAmountStr = creditAmountColIndex >= 0 ? (row[creditAmountColIndex] || '') : debitAmountStr;
              const creditAccountNumber = creditAccountColIndex >= 0 ? (row[creditAccountColIndex] || '') : '';
              
              const debitAmount = parseAmount(debitAmountStr);
              const creditAmount = parseAmount(creditAmountStr);
              
              // Pomiń wiersze bez opisu lub bez żadnej kwoty
              if (!description || (!debitAmount && !creditAmount)) {
                console.log(`Skipping row ${rowIndex}: description="${description}", debitAmount=${debitAmount}`);
                continue;
              }
              
              // Znajdź konto Winien na podstawie numeru
              const debitAccount = accounts.find(acc => 
                acc.number === debitAccountNumber || 
                acc.number.startsWith(debitAccountNumber) ||
                debitAccountNumber.startsWith(acc.number)
              );
              
              // Znajdź konto Ma na podstawie numeru
              const creditAccount = accounts.find(acc => 
                acc.number === creditAccountNumber || 
                acc.number.startsWith(creditAccountNumber) ||
                creditAccountNumber.startsWith(acc.number)
              );
              
              // Użyj kwoty (preferuj debitAmount, fallback do creditAmount)
              const amount = debitAmount || creditAmount;
              
              if (debitAccount?.id || creditAccount?.id) {
                transactionsToImport.push({
                  document_id: document.id,
                  document_number: documentNumber,
                  date: documentDate.toISOString().split('T')[0],
                  description: description,
                  debit_amount: amount,
                  credit_amount: amount,
                  debit_account_id: debitAccount?.id || null,
                  credit_account_id: creditAccount?.id || null,
                  currency: 'PLN',
                  exchange_rate: 1,
                  settlement_type: 'Bank',
                  location_id: user.location,
                  user_id: user.id,
                  display_order: rowIndex
                });
              } else {
                console.log(`Skipping row ${rowIndex}: no matching accounts for debit="${debitAccountNumber}", credit="${creditAccountNumber}"`);
              }
            }
            
            // Importuj transakcje do bazy danych
            if (transactionsToImport.length > 0) {
              const { error } = await supabase
                .from('transactions')
                .insert(transactionsToImport);
                
              if (error) throw error;
              
              // Walidacja dokumentu - sprawdź brakujące konta i zapisz błędy
              const validationErrors: { type: string; message: string }[] = [];
              const incompleteCount = transactionsToImport.filter(
                t => !t.debit_account_id || !t.credit_account_id
              ).length;
              
              if (incompleteCount > 0) {
                validationErrors.push({
                  type: 'missing_accounts',
                  message: `${incompleteCount} operacji wymaga uzupełnienia kont`
                });
                
                // Zaktualizuj dokument z błędami walidacji
                await supabase
                  .from('documents')
                  .update({ validation_errors: validationErrors })
                  .eq('id', document.id);
              }
              
              toast({
                title: "Sukces",
                description: `Utworzono dokument ${documentNumber} z ${transactionsToImport.length} operacjami.${incompleteCount > 0 ? ` ${incompleteCount} wymaga uzupełnienia kont.` : ''}`,
              });
              
              onImportComplete(1);
              onClose();
            } else {
              toast({
                title: "Uwaga",
                description: "Nie znaleziono żadnych poprawnych danych do importu. Sprawdź czy numery kont w pliku CSV odpowiadają kontom w systemie.",
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error('Błąd podczas importu:', error);
            toast({
              title: "Błąd",
              description: "Wystąpił błąd podczas importu danych",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        },
        error: (error) => {
          console.error('Błąd parsowania pliku:', error);
          toast({
            title: "Błąd",
            description: "Nie udało się przetworzyć pliku",
            variant: "destructive",
          });
          setLoading(false);
        }
      });
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas importu",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const formatAmount = (amountStr: string) => {
    const amount = parseAmount(amountStr);
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import plików CSV
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="upload">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Wczytaj plik</TabsTrigger>
            <TabsTrigger value="mapping" disabled={!file}>Mapowanie kolumn</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file" className="text-sm font-medium">
                Wybierz plik CSV
              </Label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  id="csv-file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('csv-file')?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Wybierz plik
                </Button>
                {file && (
                  <span className="text-sm text-gray-600">{file.name}</span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Obsługiwane formaty: .csv<br />
                Format przykładowy: Opis,"Kwota winien",konto winien,"Kwota ma",konto ma
              </p>
            </div>

            {file && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Data dokumentu
                </Label>
                <DatePicker
                  value={documentDate}
                  onChange={(date) => date && setDocumentDate(date)}
                  placeholder="Wybierz datę dokumentu"
                />
              </div>
            )}

            {previewData.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Podgląd danych:</h3>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Opis</th>
                        <th className="px-4 py-2 text-xs font-medium text-right text-gray-500">Kwota winien</th>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Konto winien</th>
                        <th className="px-4 py-2 text-xs font-medium text-right text-gray-500">Kwota ma</th>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Konto ma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs text-gray-700 max-w-xs truncate">{row.description}</td>
                          <td className="px-4 py-2 text-xs text-right text-gray-700">
                            {formatAmount(row.amount)}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700">{row.accountNumber}</td>
                          <td className="px-4 py-2 text-xs text-right text-gray-700">
                            {row.secondAmount && formatAmount(row.secondAmount)}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700">{row.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="mapping" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="descriptionColumn" className="text-sm font-medium">
                    Kolumna z opisem *
                  </Label>
                  <select
                    id="descriptionColumn"
                    name="descriptionColumn"
                    value={mappings.descriptionColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="amountColumn" className="text-sm font-medium">
                    Kolumna z kwotą *
                  </Label>
                  <select
                    id="amountColumn"
                    name="amountColumn"
                    value={mappings.amountColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="accountColumn" className="text-sm font-medium">
                    Kolumna z numerem konta *
                  </Label>
                  <select
                    id="accountColumn"
                    name="accountColumn"
                    value={mappings.accountColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="secondAmountColumn" className="text-sm font-medium">
                    Kolumna z drugą kwotą
                  </Label>
                  <select
                    id="secondAmountColumn"
                    name="secondAmountColumn"
                    value={mappings.secondAmountColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                <p>* Pola wymagane</p>
                <p className="mt-2">
                  <strong>Format przykładowy:</strong> Furta,"6 020,00",420-1-1-1,"6 020,00",100
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={loading || !file || !mappings.descriptionColumn || !mappings.amountColumn || !mappings.accountColumn}
          >
            {loading ? 'Importowanie...' : 'Importuj dane'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CsvImportDialog;