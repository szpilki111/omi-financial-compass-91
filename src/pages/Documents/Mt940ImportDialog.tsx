
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

interface Mt940Transaction {
  date: string;
  amount: number;
  type: 'C' | 'D'; // Credit or Debit
  description: string;
  reference: string;
  accountNumber?: string;
  counterparty?: string;
}

interface Mt940Data {
  accountNumber: string;
  statementNumber: string;
  openingBalance: number;
  closingBalance: number;
  transactions: Mt940Transaction[];
}

interface Mt940ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

const Mt940ImportDialog: React.FC<Mt940ImportDialogProps> = ({ 
  open, 
  onClose, 
  onImportComplete 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Mt940Data | null>(null);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());

  const parseMt940File = (content: string): Mt940Data => {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    
    let accountNumber = '';
    let statementNumber = '';
    let openingBalance = 0;
    let closingBalance = 0;
    const transactions: Mt940Transaction[] = [];
    
    // Store transaction details by reference for sharing between transactions
    const transactionDetailsByRef: { [key: string]: { description: string; counterparty: string; accountNumber: string } } = {};
    let currentTransaction: Partial<Mt940Transaction> = {};
    let currentDetails: { description: string; counterparty: string; accountNumber: string } = { description: '', counterparty: '', accountNumber: '' };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Account number
      if (line.startsWith(':25:')) {
        accountNumber = line.substring(4).replace('/', '');
      }
      
      // Statement number
      if (line.startsWith(':28C:')) {
        statementNumber = line.substring(5);
      }
      
      // Opening balance
      if (line.startsWith(':60F:')) {
        const balanceLine = line.substring(5);
        const amount = balanceLine.substring(8);
        openingBalance = parseFloat(amount.replace(',', '.'));
      }
      
      // Closing balance
      if (line.startsWith(':62F:')) {
        const balanceLine = line.substring(5);
        const amount = balanceLine.substring(8);
        closingBalance = parseFloat(amount.replace(',', '.'));
      }
      
      // Transaction line
      if (line.startsWith(':61:')) {
        // Save previous transaction if exists
        if (currentTransaction.date && currentTransaction.amount !== undefined) {
          transactions.push(currentTransaction as Mt940Transaction);
        }
        
        // Parse new transaction
        const transactionLine = line.substring(4);
        
        // Extract date (positions 0-5: YYMMDD)
        const dateStr = transactionLine.substring(0, 6);
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const day = parseInt(dateStr.substring(4, 6));
        const transactionDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Extract type (C for credit, D for debit)
        const typeMatch = transactionLine.match(/[CD]N/);
        const type = typeMatch ? typeMatch[0][0] as 'C' | 'D' : 'D';
        
        // Extract amount
        const amountMatch = transactionLine.match(/[CD]N(\d+,\d+)/);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;
        
        // Extract reference - get the part after // which is the reference
        const refMatch = transactionLine.match(/\/\/([^/]+)$/);
        const reference = refMatch ? refMatch[1] : '';
        
        currentTransaction = {
          date: transactionDate,
          amount,
          type,
          reference,
          description: '',
          counterparty: '',
          accountNumber: ''
        };
        
        // Check if we have stored details for this reference
        if (reference && transactionDetailsByRef[reference]) {
          const storedDetails = transactionDetailsByRef[reference];
          currentTransaction.description = storedDetails.description;
          currentTransaction.counterparty = storedDetails.counterparty;
          currentTransaction.accountNumber = storedDetails.accountNumber;
        }
      }
      
      // Transaction details
      if (line.startsWith(':86:') && currentTransaction.date) {
        const detailsLine = line.substring(4);
        const parts = detailsLine.split('^');
        
        let description = '';
        let counterparty = '';
        let accountNumber = '';
        
        for (const part of parts) {
          if (part.startsWith('00')) {
            description = part.substring(2).trim();
          } else if (part.startsWith('20')) {
            // Extract description specifically from ^20 section
            const descriptionFrom20 = part.substring(2).trim();
            if (descriptionFrom20) {
              description = descriptionFrom20; // Use ^20 section as primary description
            }
          } else if (part.startsWith('21')) {
            const titlePart = part.substring(2).trim();
            if (titlePart) {
              description += (description ? ' ' : '') + titlePart;
            }
          } else if (part.startsWith('32') || part.startsWith('33')) {
            const namePart = part.substring(2).trim();
            if (namePart) {
              counterparty += (counterparty ? ' ' : '') + namePart;
            }
          } else if (part.startsWith('38')) {
            accountNumber = part.substring(2).trim();
          }
        }
        
        // Store the details for the current transaction
        currentDetails = {
          description: description || 'Operacja bankowa',
          counterparty: counterparty,
          accountNumber: accountNumber
        };
        
        // Apply details to current transaction
        currentTransaction.description = currentDetails.description;
        currentTransaction.counterparty = currentDetails.counterparty;
        currentTransaction.accountNumber = currentDetails.accountNumber;
        
        // Store details by reference for future transactions with the same reference
        if (currentTransaction.reference) {
          transactionDetailsByRef[currentTransaction.reference] = currentDetails;
        }
      }
    }
    
    // Add last transaction
    if (currentTransaction.date && currentTransaction.amount !== undefined) {
      transactions.push(currentTransaction as Mt940Transaction);
    }
    
    return {
      accountNumber,
      statementNumber,
      openingBalance,
      closingBalance,
      transactions
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Read and parse the file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsedData = parseMt940File(content);
        setPreviewData(parsedData);
        
        console.log('Parsed MT940 data:', parsedData);
      } catch (error) {
        console.error('Error parsing MT940 file:', error);
        toast({
          title: "Błąd",
          description: "Nie udało się przetworzyć pliku MT940",
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(selectedFile, 'windows-1250'); // MT940 often uses Windows-1250 encoding
  };

  const handleImport = async () => {
    if (!previewData || !user?.location || !documentDate) {
      toast({
        title: "Błąd",
        description: "Brak danych do importu",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Generate document number using the existing function
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

      // Create one document for all transactions
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          document_number: documentNumber,
          document_name: `Wyciąg - ${previewData.statementNumber} - ${previewData.accountNumber}`,
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

      // Create all transactions for this document - MAINTAIN FILE ORDER
      const transactionsToInsert = previewData.transactions.map((transaction, index) => ({
        document_id: document.id,
        document_number: documentNumber,
        date: transaction.date,
        description: transaction.description, // Use description from ^20 section of MT940 file
        debit_amount: transaction.amount,
        credit_amount: transaction.amount,
        currency: 'PLN',
        exchange_rate: 1,
        settlement_type: 'Bank',
        location_id: user.location,
        user_id: user.id,
        // Add a sort order to maintain file sequence
        created_at: new Date(Date.now() + index * 1000).toISOString() // Offset by seconds to maintain order
      }));

      const { error: transError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);
      
      if (transError) {
        console.error('Error creating transactions:', transError);
        throw transError;
      }
      
      toast({
        title: "Sukces",
        description: `Utworzono dokument ${documentNumber} z ${previewData.transactions.length} operacjami`,
      });
      
      onImportComplete(1); // Only 1 document created
      onClose();
      
    } catch (error) {
      console.error('Error importing MT940:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas importu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
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
            Import plików MT940
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File upload */}
          <div className="space-y-2">
            <Label htmlFor="mt940-file" className="text-sm font-medium">
              Wybierz plik MT940
            </Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                id="mt940-file"
                accept=".mt940,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('mt940-file')?.click()}
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
              Obsługiwane formaty: .mt940, .txt
            </p>
          </div>

          {/* Document date */}
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

          {/* Preview */}
          {previewData && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Podgląd danych</h3>
              
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium">Numer rachunku:</span>
                  <p className="text-sm text-gray-600">{previewData.accountNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Numer wyciągu:</span>
                  <p className="text-sm text-gray-600">{previewData.statementNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Saldo początkowe:</span>
                  <p className="text-sm text-gray-600">{formatAmount(previewData.openingBalance)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Saldo końcowe:</span>
                  <p className="text-sm text-gray-600">{formatAmount(previewData.closingBalance)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">
                  Operacje do dodania ({previewData.transactions.length})
                </h4>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Data</th>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Typ</th>
                        <th className="px-4 py-2 text-xs font-medium text-right text-gray-500">Kwota</th>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Opis</th>
                        <th className="px-4 py-2 text-xs font-medium text-left text-gray-500">Kontrahent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.transactions.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs text-gray-700">{transaction.date}</td>
                          <td className="px-4 py-2 text-xs">
                            <span className={`px-2 py-1 rounded text-xs ${
                              transaction.type === 'C' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'C' ? 'Wpływ' : 'Wypływ'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-right text-gray-700">
                            {formatAmount(transaction.amount)}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700 max-w-xs truncate">
                            {transaction.description}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700 max-w-xs truncate">
                            {transaction.counterparty || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button 
            type="button" 
            onClick={handleImport} 
            disabled={loading || !previewData || !documentDate}
          >
            {loading ? 'Importowanie...' : `Importuj jako 1 dokument`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Mt940ImportDialog;
