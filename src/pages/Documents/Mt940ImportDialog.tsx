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
  type: 'C' | 'D';
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

const Mt940ImportDialog: React.FC<Mt940ImportDialogProps> = ({ open, onClose, onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Mt940Data | null>(null);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());
  const { user } = useAuth();
  const { toast } = useToast();

  const extractDescription = (detailsLine: string): string => {
    let description = 'Operacja bankowa';
    if (!detailsLine || !detailsLine.includes('^')) {
      console.log('No tags or empty line:', detailsLine);
      return description;
    }

    const parts = detailsLine.split(/(?=\^[0-9]{2})/);
    let descParts: string[] = [];

    for (const part of parts) {
      if (part.match(/^\^[2][0-9]|^3[2-3]|^00/)) {
        const content = part.replace(/^\^[0-9]{2}/, '').trim();
        if (content) descParts.push(content);
      }
    }

    if (descParts.length > 0) {
      description = descParts.join(' ').replace(/\s+/g, ' ').trim();
    }

    console.log('Extracted:', description, 'from:', descParts);
    return description;
  };

  const parseMt940File = (content: string): Mt940Data => {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    
    let accountNumber = '';
    let statementNumber = '';
    let openingBalance = 0;
    let closingBalance = 0;
    const transactions: Mt940Transaction[] = [];
    
    let currentTransaction: Partial<Mt940Transaction> = {};
    let currentDetails = '';
    let inDetailsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log('Processing line:', line);

      if (line.startsWith(':25:')) {
        accountNumber = line.substring(4).replace('/', '');
      } else if (line.startsWith(':28C:')) {
        statementNumber = line.substring(5);
      } else if (line.startsWith(':60F:')) {
        const balanceLine = line.substring(5);
        const amount = balanceLine.substring(8);
        openingBalance = parseFloat(amount.replace(',', '.'));
      } else if (line.startsWith(':62F:')) {
        const balanceLine = line.substring(5);
        const amount = balanceLine.substring(8);
        closingBalance = parseFloat(amount.replace(',', '.'));
      } else if (line.startsWith(':61:')) {
        // Zapisz poprzednią transakcję z opisem
        if (currentTransaction.date && currentTransaction.amount !== undefined) {
          if (currentDetails) {
            console.log('Processing final details for previous transaction:', currentDetails);
            currentTransaction.description = extractDescription(currentDetails);
            
            // Wyodrębnij kontrahenta i numer konta
            const parts = currentDetails.split('^');
            let counterparty = '';
            let accountNumber = '';

            for (const part of parts) {
              if (part.startsWith('32') || part.startsWith('33')) {
                const namePart = part.substring(2).trim();
                if (namePart) {
                  counterparty += (counterparty ? ' ' : '') + namePart;
                }
              } else if (part.startsWith('38')) {
                accountNumber = part.substring(2).trim();
              }
            }

            currentTransaction.counterparty = counterparty;
            currentTransaction.accountNumber = accountNumber;
          }
          console.log('Final transaction before adding new:', currentTransaction);
          transactions.push(currentTransaction as Mt940Transaction);
        }

        // Reset dla nowej transakcji
        currentDetails = '';
        inDetailsSection = false;

        const transactionLine = line.substring(4);
        const dateStr = transactionLine.substring(0, 6);
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const day = parseInt(dateStr.substring(4, 6));
        const transactionDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // Improved regex to handle various MT940 formats (PKO BP, Pekao, mBank, etc.)
        // Matches: CDN, CN, DN followed by amount with comma or dot
        const typeMatch = transactionLine.match(/([CD])N?/);
        const type = typeMatch ? typeMatch[1] as 'C' | 'D' : 'D';

        // More flexible regex for amount - handles formats like: CN1234,56 / CDN1234.56 / C1234,56
        const amountMatch = transactionLine.match(/[CD]N?(\d+[.,]\d+)/);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;

        const refMatch = transactionLine.match(/\/\/([^/]+)$/);
        const reference = refMatch ? refMatch[1] : '';

        currentTransaction = {
          date: transactionDate,
          amount,
          type,
          reference,
          description: 'Operacja bankowa',
          counterparty: '',
          accountNumber: ''
        };

        console.log('Created new transaction:', currentTransaction);
      } else if (line.startsWith(':86:')) {
        inDetailsSection = true;
        currentDetails = line.substring(4);
        console.log('Started details section:', currentDetails);
      } else if (inDetailsSection && !line.startsWith(':')) {
        // Kontynuacja pola :86:
        currentDetails += line;
        console.log('Continued details:', currentDetails);
      } else if (inDetailsSection && line.startsWith(':')) {
        // Koniec pola :86:, przetwórz zebrane detale
        if (currentTransaction.date && currentDetails) {
          console.log('Processing complete details:', currentDetails);
          currentTransaction.description = extractDescription(currentDetails);

          // Wyodrębnij kontrahenta i numer konta
          const parts = currentDetails.split('^');
          let counterparty = '';
          let accountNumber = '';

          for (const part of parts) {
            if (part.startsWith('32') || part.startsWith('33')) {
              const namePart = part.substring(2).trim();
              if (namePart) {
                counterparty += (counterparty ? ' ' : '') + namePart;
              }
            } else if (part.startsWith('38')) {
              accountNumber = part.substring(2).trim();
            }
          }

          currentTransaction.counterparty = counterparty;
          currentTransaction.accountNumber = accountNumber;
          console.log('Updated transaction with details:', currentTransaction);
        }
        
        inDetailsSection = false;
        currentDetails = '';
        
        // Sprawdź, czy nowa linia też zaczyna sekcję :86:
        if (line.startsWith(':86:')) {
          inDetailsSection = true;
          currentDetails = line.substring(4);
          console.log('Started new details section:', currentDetails);
        }
      }
    }

    // Przetwórz ostatnią transakcję
    if (currentTransaction.date && currentTransaction.amount !== undefined) {
      if (currentDetails) {
        console.log('Processing final details for last transaction:', currentDetails);
        currentTransaction.description = extractDescription(currentDetails);
        
        const parts = currentDetails.split('^');
        let counterparty = '';
        let accountNumber = '';

        for (const part of parts) {
          if (part.startsWith('32') || part.startsWith('33')) {
            const namePart = part.substring(2).trim();
            if (namePart) {
              counterparty += (counterparty ? ' ' : '') + namePart;
            }
          } else if (part.startsWith('38')) {
            accountNumber = part.substring(2).trim();
          }
        }

        currentTransaction.counterparty = counterparty;
        currentTransaction.accountNumber = accountNumber;
      }
      console.log('Final last transaction:', currentTransaction);
      transactions.push(currentTransaction as Mt940Transaction);
    }

    console.log('Final parsed transactions:', transactions);
    return {
      accountNumber,
      statementNumber,
      openingBalance,
      closingBalance,
      transactions
    };
  };

  // CP852 (DOS Latin 2) to UTF-8 character mapping for Polish characters
  const cp852ToUtf8Map: { [key: number]: string } = {
    // Polish characters in CP852
    0x86: 'ć', 0x87: 'ç', 0x88: 'ł', 0x89: 'ë', 0x8C: 'î', 0x8D: 'ź', 0x8F: 'Ą',
    0x91: 'ź', 0x92: 'ł', 0x97: 'Ś', 0x98: 'ś', 0x9C: 'ś', 0x9D: 'Ł', 0x9E: 'ś', 0x9F: 'ć',
    0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ą', 0xA5: 'ą',
    0xA6: 'ź', 0xA7: 'Ź', 0xA8: 'ę', 0xAB: 'ź', 0xAC: 'ż',
    0xBD: 'Ż', 0xBE: 'ż',
    0xD3: 'Ó', 0xE0: 'Ó', 0xE3: 'Ń', 0xE4: 'ń', 0xE5: 'ń', 0xE6: 'ń', 0xE7: 'ń',
    0xEA: 'Ę', 0xEB: 'ę', 0xF3: 'ó',
  };

  // Mazovia encoding (Polish DOS variant) mapping
  const mazoviaToUtf8Map: { [key: number]: string } = {
    0x86: 'ą', 0x8D: 'ć', 0x8F: 'ę', 0x92: 'ł', 0x9E: 'ń', 0x98: 'ó',
    0x9C: 'ś', 0xA0: 'ź', 0xA1: 'ż', 0x8E: 'Ą', 0x95: 'Ć', 0x90: 'Ę',
    0x9D: 'Ł', 0xA5: 'Ń', 0xA3: 'Ó', 0x97: 'Ś', 0xA6: 'Ź', 0xA7: 'Ż',
  };

  // Convert bytes using custom mapping
  const convertWithMap = (uint8Array: Uint8Array, charMap: { [key: number]: string }): string => {
    let result = '';
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      if (charMap[byte]) {
        result += charMap[byte];
      } else if (byte < 128) {
        result += String.fromCharCode(byte);
      } else {
        // Try to use the byte as-is for extended ASCII
        result += String.fromCharCode(byte);
      }
    }
    return result;
  };

  // Detect and convert encoding to UTF-8
  // Polish bank files often use Windows-1250, ISO-8859-2, CP852, or Mazovia
  const detectAndConvertEncoding = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Check for UTF-8 BOM
    if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      console.log('Detected UTF-8 with BOM');
      return new TextDecoder('utf-8').decode(buffer);
    }

    // Function to count Polish characters in decoded text
    const countPolishChars = (text: string): number => {
      const polishChars = text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g);
      return polishChars ? polishChars.length : 0;
    };

    // Function to count broken/garbled characters
    const countBrokenChars = (text: string): number => {
      // Common broken character patterns from wrong encoding
      const brokenPatterns = text.match(/[˘¤—Ťťŕ°±˛˝˙ţŢ¨©®]/g);
      const replacementChars = text.match(/[\uFFFD�]/g);
      return (brokenPatterns ? brokenPatterns.length : 0) + (replacementChars ? replacementChars.length : 0);
    };

    // Try standard encodings first
    const encodings = ['utf-8', 'windows-1250', 'iso-8859-2'];
    let bestResult = { text: '', encoding: 'utf-8', score: -Infinity };

    for (const encoding of encodings) {
      try {
        const decoder = new TextDecoder(encoding, { fatal: false });
        const text = decoder.decode(buffer);
        
        const polishCount = countPolishChars(text);
        const brokenCount = countBrokenChars(text);
        const score = polishCount * 10 - brokenCount * 5;
        
        console.log(`Encoding ${encoding}: Polish chars=${polishCount}, Broken chars=${brokenCount}, Score=${score}`);
        
        if (score > bestResult.score) {
          bestResult = { text, encoding, score };
        }
        
        if (encoding === 'utf-8' && polishCount > 0 && brokenCount === 0) {
          console.log('Perfect UTF-8 detected');
          return text;
        }
      } catch (e) {
        console.log(`Failed to decode with ${encoding}:`, e);
      }
    }

    // If standard encodings didn't work well, try CP852 and Mazovia (manual conversion)
    if (bestResult.score <= 0) {
      console.log('Trying CP852/Mazovia manual conversion...');
      
      // Try CP852 first
      const cp852Text = convertWithMap(uint8Array, cp852ToUtf8Map);
      const cp852Polish = countPolishChars(cp852Text);
      const cp852Broken = countBrokenChars(cp852Text);
      const cp852Score = cp852Polish * 10 - cp852Broken * 5;
      console.log(`CP852 manual: Polish=${cp852Polish}, Broken=${cp852Broken}, Score=${cp852Score}`);
      
      if (cp852Score > bestResult.score) {
        bestResult = { text: cp852Text, encoding: 'cp852', score: cp852Score };
      }

      // Try Mazovia
      const mazoviaText = convertWithMap(uint8Array, mazoviaToUtf8Map);
      const mazoviaPolish = countPolishChars(mazoviaText);
      const mazoviaBroken = countBrokenChars(mazoviaText);
      const mazoviaScore = mazoviaPolish * 10 - mazoviaBroken * 5;
      console.log(`Mazovia manual: Polish=${mazoviaPolish}, Broken=${mazoviaBroken}, Score=${mazoviaScore}`);
      
      if (mazoviaScore > bestResult.score) {
        bestResult = { text: mazoviaText, encoding: 'mazovia', score: mazoviaScore };
      }
    }

    // Final fallback: apply character fixes to Windows-1250 result
    if (bestResult.score <= 0) {
      const win1250Text = new TextDecoder('windows-1250', { fatal: false }).decode(buffer);
      
      // Apply manual character replacements for common bank file issues
      const fixedText = win1250Text
        .replace(/˘/g, 'ó')   // breve -> ó
        .replace(/—/g, 'Ś')   // em dash -> Ś
        .replace(/¨/g, 'Ę')   // diaeresis -> Ę
        .replace(/˝/g, 'Ż')   // double acute -> Ż
        .replace(/Ť/g, 'Ś')
        .replace(/ť/g, 'ś')
        .replace(/ŕ/g, 'ą')
        .replace(/Ľ/g, 'Ł')
        .replace(/ľ/g, 'ł')
        .replace(/¤/g, 'ń')
        .replace(/©/g, 'ę')
        .replace(/®/g, 'ż')
        .replace(/°/g, 'ó')
        .replace(/±/g, 'ą')
        .replace(/˛/g, 'ę')
        .replace(/ţ/g, 'ź')
        .replace(/Ţ/g, 'Ź');
      
      const fixedPolish = countPolishChars(fixedText);
      const fixedBroken = countBrokenChars(fixedText);
      console.log(`Manual fixes: Polish=${fixedPolish}, Broken=${fixedBroken}`);
      
      if (fixedPolish > 0 || fixedBroken < countBrokenChars(bestResult.text)) {
        bestResult = { text: fixedText, encoding: 'windows-1250-fixed', score: fixedPolish * 10 };
      }
    }

    console.log(`Selected encoding: ${bestResult.encoding} with score ${bestResult.score}`);
    return bestResult.text;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    try {
      // Detect and convert encoding automatically
      const content = await detectAndConvertEncoding(selectedFile);
      console.log('File content:', content);
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

  const handleImport = async () => {
    if (!previewData || previewData.transactions.length === 0) {
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
        description: "Nie można określić lokalizacji użytkownika. Spróbuj odświeżyć stronę.",
        variant: "destructive",
      });
      return;
    }
    
    if (!documentDate) {
      toast({
        title: "Błąd",
        description: "Wybierz datę dokumentu",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
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

      // Transakcje będą importowane bez przypisanych kont
      // Użytkownik uzupełni je ręcznie po imporcie
      const transactionsToInsert = previewData.transactions.map((transaction, index) => ({
        document_id: document.id,
        document_number: documentNumber,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        debit_amount: transaction.amount,
        credit_amount: transaction.amount,
        debit_account_id: null,
        credit_account_id: null,
        currency: 'PLN',
        exchange_rate: 1,
        settlement_type: 'Bank',
        location_id: user.location,
        user_id: user.id,
        created_at: new Date(Date.now() + index * 1000).toISOString()
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
      
      onImportComplete(1);
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="mt940-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import plików MT940
          </DialogTitle>
        </DialogHeader>
        <p id="mt940-description" className="sr-only">
          Import plików bankowych w formacie MT940
        </p>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mt940-file" className="text-sm font-medium">
              Wybierz plik MT940
            </Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                id="mt940-file"
                accept=".mt940,.txt,.sta,.STA,.exp,.EXP"
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
              Obsługiwane formaty: .mt940, .txt, .sta, .exp (Pekao 24)
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

          {previewData && (
            <div className="space-y-4">
              <div>
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
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              transaction.type === 'C' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'C' ? '+ Wpływ' : '− Wypływ'}
                            </span>
                          </td>
                          <td className={`px-4 py-2 text-xs text-right font-medium ${
                            transaction.type === 'C' 
                              ? 'text-green-700' 
                              : 'text-red-700'
                          }`}>
                            {transaction.type === 'C' ? '+' : '−'} {formatAmount(transaction.amount)}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700 max-w-xs" title={transaction.description}>
                            {transaction.description}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-700 max-w-xs" title={transaction.counterparty || '-'}>
                            {transaction.counterparty || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  <p><strong>Uwaga:</strong> Każda transakcja będzie miała wypełnione oba pola kwot (debit i credit) tą samą wartością z pliku.</p>
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
