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
import { ImportRow } from '@/types/kpir';
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Papa from 'papaparse';

interface KpirImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

const KpirImportDialog: React.FC<KpirImportDialogProps> = ({ open, onClose, onImportComplete }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const { data: accounts = [] } = useFilteredAccounts();
  const [mappings, setMappings] = useState({
    dateColumn: '',
    descriptionColumn: '',
    amountColumn: '',
    accountColumn: '',
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Użyj Papa Parse do odczytania pliku CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Ustaw dostępne kolumny z nagłówków CSV
        if (results.data.length > 0) {
          const firstRow = results.data[0] as Record<string, any>;
          setAvailableColumns(Object.keys(firstRow));
          
          // Automatycznie dopasuj kolumny jeśli ich nazwy są podobne
          const columnMapping = {
            dateColumn: findBestMatchingColumn(Object.keys(firstRow), ['data', 'date', 'datum']),
            descriptionColumn: findBestMatchingColumn(Object.keys(firstRow), ['opis', 'description', 'tytuł', 'title', 'treść']),
            amountColumn: findBestMatchingColumn(Object.keys(firstRow), ['kwota', 'amount', 'suma', 'wartość', 'value']),
            accountColumn: findBestMatchingColumn(Object.keys(firstRow), ['konto', 'account', 'rachunek', 'nr konta']),
          };
          
          setMappings(columnMapping);
          
          // Przygotuj dane do podglądu (pierwsze 5 wierszy)
          const preview = results.data.slice(0, 5).map((row: any) => ({
            date: row[columnMapping.dateColumn] || '',
            description: row[columnMapping.descriptionColumn] || '',
            amount: parseFloat(row[columnMapping.amountColumn]) || 0,
            account: row[columnMapping.accountColumn] || '',
          }));
          
          setPreviewData(preview);
        }
      }
    });
    // Accounts are already fetched via useFilteredAccounts hook
  };

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

  const handleMappingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMappings(prev => ({ ...prev, [name]: value }));
  };

  const handleImport = async () => {
    if (!file || !user?.location) {
      toast({
        title: "Błąd",
        description: "Wybierz plik do importu",
        variant: "destructive",
      });
      return;
    }
    
    // Sprawdź, czy wszystkie wymagane mapowania zostały ustawione
    if (!mappings.dateColumn || !mappings.descriptionColumn || !mappings.amountColumn) {
      toast({
        title: "Błąd",
        description: "Określ mapowanie wszystkich wymaganych kolumn",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Parsuj cały plik
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Przygotuj dane do importu - MAINTAIN FILE ORDER
            const transactionsToImport = [];
            const defaultDebitAccountId = accounts.find(acc => acc.number.includes('100'))?.id || '';
            
            // Process rows in file order (results.data maintains original order)
            for (let rowIndex = 0; rowIndex < results.data.length; rowIndex++) {
              const row = results.data[rowIndex] as Record<string, any>;
              const date = row[mappings.dateColumn];
              const description = row[mappings.descriptionColumn]; // Use actual description from file
              const amountStr = row[mappings.amountColumn];
              let amount = 0;
              
              // Obsługa różnych formatów kwoty
              if (typeof amountStr === 'string') {
                // Usuń symbole waluty, spacje i zamień przecinki na kropki
                const cleanAmount = amountStr
                  .replace(/[^\d,.-]/g, '')
                  .replace(',', '.');
                
                amount = parseFloat(cleanAmount);
              } else if (typeof amountStr === 'number') {
                amount = amountStr;
              }
              
              if (!date || !description || isNaN(amount)) {
                continue; // Pomiń nieprawidłowe wiersze
              }
              
              // Dopasuj konto na podstawie numeru konta lub domyślnie użyj konta "Rozrachunek"
              let creditAccountId = '';
              if (mappings.accountColumn && row[mappings.accountColumn]) {
                const accountNumber = row[mappings.accountColumn];
                const matchedAccount = accounts.find(acc => 
                  acc.number.includes(accountNumber) || acc.name.toLowerCase().includes(accountNumber.toLowerCase())
                );
                creditAccountId = matchedAccount?.id || '';
              }
              
              // Jeśli nie znaleziono konta, użyj domyślnego konta przychodów
              if (!creditAccountId) {
                creditAccountId = accounts.find(acc => acc.number.includes('700'))?.id || '';
              }
              
              // Konwertuj datę do formatu YYYY-MM-DD
              let formattedDate = date;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                // Sprawdź różne formaty daty
                const dateParts = date.split(/[\.\/\-]/);
                if (dateParts.length === 3) {
                  let day, month, year;
                  
                  // Sprawdź, czy pierwszy element to rok (ma 4 cyfry)
                  if (dateParts[0].length === 4) {
                    // Format YYYY-MM-DD
                    [year, month, day] = dateParts;
                  } else {
                    // Format DD-MM-YYYY lub MM-DD-YYYY
                    // Zakładamy, że w Polsce częściej używamy DD-MM-YYYY
                    [day, month, year] = dateParts;
                    
                    // Jeżeli rok ma 2 cyfry, dodaj '20' z przodu
                    if (year.length === 2) {
                      year = '20' + year;
                    }
                  }
                  
                  // Upewnij się, że miesiąc i dzień mają dwie cyfry
                  if (month.length === 1) month = '0' + month;
                  if (day.length === 1) day = '0' + day;
                  
                  formattedDate = `${year}-${month}-${day}`;
                }
              }
              
              // Dodaj transakcję tylko jeśli wszystkie wartości są poprawne
              if (formattedDate && description && amount && defaultDebitAccountId && creditAccountId) {
                const absoluteAmount = Math.abs(amount);
                transactionsToImport.push({
                  date: formattedDate,
                  description: description, // Use the actual title/description from the file instead of transaction type
                  amount: absoluteAmount,
                  debit_amount: absoluteAmount, // Wypełnij oba pola kwot tą samą wartością
                  credit_amount: absoluteAmount, // Wypełnij oba pola kwot tą samą wartością
                  debit_account_id: amount > 0 ? defaultDebitAccountId : creditAccountId,
                  credit_account_id: amount > 0 ? creditAccountId : defaultDebitAccountId,
                  settlement_type: 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
                  currency: 'PLN',
                  exchange_rate: 1,
                  location_id: user.location,
                  user_id: user.id,
                  // Add timestamp offset to maintain file order
                  created_at: new Date(Date.now() + rowIndex * 1000).toISOString()
                });
              }
            }
            
            // Importuj transakcje do bazy danych - they will be inserted in file order
            if (transactionsToImport.length > 0) {
              const { error } = await supabase
                .from('transactions')
                .insert(transactionsToImport);
                
              if (error) throw error;
              
              onImportComplete(transactionsToImport.length);
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
      console.error('Błąd podczas importu:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił nieoczekiwany błąd",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import operacji finansowych</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="upload">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Wczytaj plik</TabsTrigger>
            <TabsTrigger value="mapping" disabled={!file}>Mapowanie kolumn</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file" className="text-sm font-medium">
                Wybierz plik CSV do importu
              </Label>
              <input
                type="file"
                id="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="w-full p-2 border border-omi-gray-300 rounded-md"
              />
              <p className="text-xs text-omi-gray-500">
                Obsługiwane formaty: CSV, Excel (.xls, .xlsx)
              </p>
            </div>
            
            {previewData.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Podgląd danych:</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-xs font-medium text-left text-omi-gray-500">Data</th>
                        <th className="px-2 py-1 text-xs font-medium text-left text-omi-gray-500">Opis</th>
                        <th className="px-2 py-1 text-xs font-medium text-right text-omi-gray-500">Kwota</th>
                        <th className="px-2 py-1 text-xs font-medium text-left text-omi-gray-500">Konto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.map((row, index) => (
                        <tr key={index}>
                          <td className="px-2 py-1 text-xs text-omi-gray-700">{row.date}</td>
                          <td className="px-2 py-1 text-xs text-omi-gray-700">{row.description}</td>
                          <td className="px-2 py-1 text-xs text-right text-omi-gray-700">
                            {row.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-1 text-xs text-omi-gray-700">{row.account}</td>
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
                  <Label htmlFor="dateColumn" className="text-sm font-medium">
                    Kolumna z datą *
                  </Label>
                  <select
                    id="dateColumn"
                    name="dateColumn"
                    value={mappings.dateColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-omi-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="descriptionColumn" className="text-sm font-medium">
                    Kolumna z opisem *
                  </Label>
                  <select
                    id="descriptionColumn"
                    name="descriptionColumn"
                    value={mappings.descriptionColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-omi-gray-300 rounded-md"
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
                    className="w-full p-2 border border-omi-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="accountColumn" className="text-sm font-medium">
                    Kolumna z kontem
                  </Label>
                  <select
                    id="accountColumn"
                    name="accountColumn"
                    value={mappings.accountColumn}
                    onChange={handleMappingChange}
                    className="w-full p-2 border border-omi-gray-300 rounded-md"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {availableColumns.map(column => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="text-xs text-omi-gray-500">
                <p>* Pola wymagane</p>
                <p className="mt-2">
                  <strong>Uwaga:</strong> Jeśli kolumna z kontem nie jest określona, 
                  system użyje domyślnego konta przychodów lub rozchodów w zależności od kwoty.
                </p>
                <p className="mt-1">
                  Kwoty dodatnie są importowane jako przychody, ujemne jako wydatki.
                  Operacje będą importowane w kolejności z pliku z zachowaniem oryginalnych tytułów.
                  Każda transakcja będzie miała wypełnione oba pola kwot (debit i credit) tą samą wartością.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button 
            type="button" 
            onClick={handleImport} 
            disabled={loading || !file || !mappings.dateColumn || !mappings.descriptionColumn || !mappings.amountColumn}
          >
            {loading ? 'Importowanie...' : 'Importuj dane'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KpirImportDialog;
