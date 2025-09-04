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
import Papa from 'papaparse';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

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
  const [accounts, setAccounts] = useState<Account[]>([]);
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

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name, type');
        
      if (error) throw error;
      
      setAccounts(data);
    } catch (error) {
      console.error('Błąd podczas pobierania kont:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Parse CSV file
    Papa.parse(selectedFile, {
      header: false, // Używamy false bo plik może nie mieć nagłówków
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
    
    // Pobierz konta z bazy danych
    fetchAccounts();
  };

  const handleMappingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMappings(prev => ({ ...prev, [name]: value }));
  };

const parseAmount = (amountStr: string): number => {
  if (!amountStr) return 0;
  console.log('Raw amount:', amountStr); // Debugowanie
  const cleanAmount = amountStr
    .replace(/[\s\xa0]/g, '') // Usuwa spacje i niełamliwe spacje
    .replace(',', '.');
  console.log('Cleaned amount:', cleanAmount); // Debugowanie
  const parsed = parseFloat(cleanAmount) || 0;
  console.log('Parsed amount:', parsed); // Debugowanie
  return parsed * 1000; // Przelicz na grosze
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

      // Parsuj pełny plik CSV
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const transactionsToImport = [];
            
            // Znajdź domyślne konta
            const defaultDebitAccountId = accounts.find(acc => acc.number.includes('100'))?.id || '';
            
            for (let rowIndex = 0; rowIndex < results.data.length; rowIndex++) {
              const row = results.data[rowIndex] as string[];
              
              const description = row[parseInt(mappings.descriptionColumn.split(' ')[1]) - 1] || '';
              const amountStr = row[parseInt(mappings.amountColumn.split(' ')[1]) - 1] || '';
              const accountNumber = row[parseInt(mappings.accountColumn.split(' ')[1]) - 1] || '';
              
              const amount = parseAmount(amountStr);
              
              if (!description || !amount || !accountNumber) {
                continue; // Pomiń nieprawidłowe wiersze
              }
              
              // Znajdź konto na podstawie numeru
              let creditAccountId = '';
              const matchedAccount = accounts.find(acc => 
                acc.number.includes(accountNumber) || 
                accountNumber.includes(acc.number)
              );
              creditAccountId = matchedAccount?.id || '';
              
              // Jeśli nie znaleziono konta, użyj domyślnego konta przychodów
              if (!creditAccountId) {
                creditAccountId = accounts.find(acc => acc.number.includes('700'))?.id || '';
              }
              
              if (defaultDebitAccountId && creditAccountId) {
                const absoluteAmount = Math.abs(amount);
                transactionsToImport.push({
                  document_id: document.id,
                  document_number: documentNumber,
                  date: documentDate.toISOString().split('T')[0],
                  description: description,
                  debit_amount: absoluteAmount,
                  credit_amount: absoluteAmount,
                  debit_account_id: amount > 0 ? defaultDebitAccountId : creditAccountId,
                  credit_account_id: amount > 0 ? creditAccountId : defaultDebitAccountId,
                  currency: 'PLN',
                  exchange_rate: 1,
                  settlement_type: 'Bank',
                  location_id: user.location,
                  user_id: user.id,
                  created_at: new Date(Date.now() + rowIndex * 1000).toISOString()
                });
              }
            }
            
            // Importuj transakcje do bazy danych
            if (transactionsToImport.length > 0) {
              const { error } = await supabase
                .from('transactions')
                .insert(transactionsToImport);
                
              if (error) throw error;
              
              toast({
                title: "Sukces",
                description: `Utworzono dokument ${documentNumber} z ${transactionsToImport.length} operacjami`,
              });
              
              onImportComplete(1);
              onClose();
            } else {
              toast({
                title: "Uwaga",
                description: "Nie znaleziono żadnych poprawnych danych do importu",
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