import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Calculator, FileText, FileUp, Download, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import DocumentDialog from './DocumentDialog';
import DocumentsTable from './DocumentsTable';
import Mt940ImportDialog from './Mt940ImportDialog';
import CsvImportDialog from './CsvImportDialog';
import ExcelFormImportDialog from './ExcelFormImportDialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Document {
  id: string;
  document_number: string;
  document_name: string;
  document_date: string;
  location_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  currency: string;
  locations?: {
    name: string;
  } | null;
  profiles?: {
    name: string;
  } | null;
  transaction_count?: number;
  total_amount?: number;
}

const DocumentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMt940ImportOpen, setIsMt940ImportOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isExcelFormImportOpen, setIsExcelFormImportOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isImportSectionOpen, setIsImportSectionOpen] = useState(false);

  const isAdminOrProvincial = user?.role === 'admin' || user?.role === 'prowincjal';

  // Fetch locations for filter (only for admin/prowincjal)
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrProvincial,
  });

  // Fetch documents with related data
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      console.log('Fetching documents for user:', user?.id);
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          locations(name),
          profiles!documents_user_id_fkey(name)
        `)
        .order('document_number', { ascending: false }); // Sortowanie od najnowszych

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }

      console.log('Raw documents data:', data);

      // Get transaction counts and total amounts for each document
      const documentsWithCounts = await Promise.all(
        (data || []).map(async (doc) => {
          // Get transaction count
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', doc.id);
          
          // Get all transactions for this document to calculate total amount
          const { data: transactions, error: transactionsError } = await supabase
            .from('transactions')
            .select('debit_amount, credit_amount, amount, currency, exchange_rate')
            .eq('document_id', doc.id);
          
          if (transactionsError) {
            console.error('Error fetching transactions for document:', doc.id, transactionsError);
          }
          
          // Calculate total amount using the same logic as in DocumentDialog
          // Convert transactions to document currency and sum them
          const totalAmount = transactions?.reduce((sum, transaction) => {
            const debitAmount = transaction.debit_amount !== undefined ? transaction.debit_amount : transaction.amount;
            const creditAmount = transaction.credit_amount !== undefined ? transaction.credit_amount : transaction.amount;
            const exchangeRate = Number(transaction.exchange_rate) || 1;
            
            // Convert to document currency if transaction currency is different
            let debitInDocCurrency = debitAmount;
            let creditInDocCurrency = creditAmount;
            
            if (transaction.currency !== doc.currency) {
              // Convert from transaction currency to PLN first, then to document currency
              if (transaction.currency !== 'PLN') {
                debitInDocCurrency = debitAmount * exchangeRate;
                creditInDocCurrency = creditAmount * exchangeRate;
              }
              // If document currency is not PLN, convert from PLN to document currency
              // This would require exchange rates, for now we keep it simple
            }
            
            return sum + debitInDocCurrency + creditInDocCurrency;
          }, 0) || 0;
          
          console.log(`Document ${doc.document_number}: ${transactions?.length || 0} transactions, total amount: ${totalAmount} ${doc.currency}`);
          
          return {
            ...doc,
            // Handle the profiles array by taking the first element or null
            profiles: Array.isArray(doc.profiles) && doc.profiles.length > 0 ? doc.profiles[0] : null,
            transaction_count: count || 0,
            total_amount: totalAmount
          };
        })
      );

      console.log('Documents with counts and totals:', documentsWithCounts);
      return documentsWithCounts;
    },
  });

  // Filter documents based on search term and location
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];

    let filtered = documents;

    // Filter by location (for admin/prowincjal)
    if (isAdminOrProvincial && selectedLocationId !== 'all') {
      filtered = filtered.filter(doc => doc.location_id === selectedLocationId);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.document_number.toLowerCase().includes(search) ||
        doc.document_name.toLowerCase().includes(search) ||
        doc.locations?.name?.toLowerCase().includes(search) ||
        format(new Date(doc.document_date), 'dd.MM.yyyy').includes(search)
      );
    }

    return filtered;
  }, [documents, searchTerm, selectedLocationId, isAdminOrProvincial]);

  const handleDocumentCreated = () => {
    refetch();
    setIsDialogOpen(false);
    toast({
      title: "Sukces",
      description: "Dokument został utworzony pomyślnie",
    });
  };

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setIsDialogOpen(true);
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten dokument? Wszystkie powiązane operacje również zostaną usunięte.')) {
      return;
    }

    try {
      // Call the Postgres function to delete document and related transactions
      const { error } = await supabase.rpc('delete_document_with_transactions', {
        p_document_id: documentId
      });

      if (error) {
        console.error('Error deleting document:', error);
        throw error;
      }

      toast({
        title: "Sukces",
        description: "Dokument i powiązane operacje zostały usunięte",
      });

      // Refresh the documents list
      refetch();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć dokumentu",
        variant: "destructive",
      });
    }
  };

  const handleSearchAccounts = () => {
    navigate('/wyszukaj-konta');
  };

  const handleSearchOperations = () => {
    navigate('/kpir');
  };

  const handleMt940ImportComplete = (count: number) => {
    refetch();
    setIsMt940ImportOpen(false);
    toast({
      title: "Sukces",
      description: `Zaimportowano ${count} dokumentów z pliku MT940`,
    });
  };

  const handleCsvImportComplete = (count: number) => {
    refetch();
    setIsCsvImportOpen(false);
    toast({
      title: "Sukces",
      description: `Zaimportowano ${count} dokumentów z pliku CSV`,
    });
  };

  const handleExcelFormImportComplete = (count: number) => {
    refetch();
    setIsExcelFormImportOpen(false);
    toast({
      title: "Sukces",
      description: `Zaimportowano ${count} dokumentów z formularza rozliczeń Excel`,
    });
  };

  const downloadExcelFormTemplate = () => {
    // Dynamicznie importuj xlsx i generuj szablon
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();
      
      // Dokładny układ zgodny z formularzem - kolumny A-I, wiersze 1-30+
      const templateData = [
        // Wiersz 1: Nagłówek (merge później)
        ['', '', '', '', 'Formularz rozliczeń indywidualnych', '', '', '', ''],
        // Wiersz 2: Podtytuł + Imię i Nazwisko
        ['', 'Wypełniamy tylko komórki zacienione.', '', '', 'Imię i Nazwisko:', '', '', '', ''],
        // Wiersz 3: Placówka
        ['', '', '', 'Placówka:', '', '', '', '', '2-17'],
        // Wiersz 4: Gotówka/rachunek
        ['', '', '', 'Gotówka/rachunek (podać nr)', 'gotówka', '', '', '', '100-2-17'],
        // Wiersz 5: pusty
        ['', '', '', '', '', '', '', '', ''],
        // Wiersz 6: Miesiąc i Rok
        ['', '', 'Miesiąc:', '', '', '', '', 'Rok:', ''],
        // Wiersz 7: Nagłówki sekcji
        ['', '', 'PRZYCHODY', '', '', '', 'ROZCHODY', '', ''],
        // Wiersz 8: Nagłówki kolumn
        ['LP', 'Konto', 'Opis', '', 'Kwota', 'LP', 'Konto', 'Opis', 'Kwota'],
        // Wiersz 9: Saldo z poprzedniego okresu
        ['1.', '', 'Saldo z poprzedniego okresu', '', '', '1.', '401', 'Biurowe', ''],
        // Wiersz 10
        ['2.', '149', 'Z kasy domowej', '', '', '2.', '402', 'Poczta przesyłki kurierskie', ''],
        // Wiersz 11
        ['3.', '210', 'Intencje, ilość:', '', '', '3.', '403', 'Telefony, Internet, TV', ''],
        // Wiersz 12
        ['4.', '702', 'Misje/Rekolekcje/inne', '', '', '4.', '404', 'Reprezentacyjne', ''],
        // Wiersz 13
        ['5.', '703', 'Duszpasterstwo parafialne (zastępstwa itp.)', '', '', '5.', '405', 'Prowizje opłaty bankowe', ''],
        // Wiersz 14
        ['6.', '704', 'Kolęda', '', '', '6.', '406', 'Usługi serwisowe', ''],
        // Wiersz 15
        ['7.', '705', 'Zastępstwa zagraniczne', '', '', '7.', '410', 'Pralnia, artykuły chemiczne i konserwacja', ''],
        // Wiersz 16
        ['8.', '710', 'Odsetki i przychody finansowe', '', '', '8.', '411', 'Podróże komunikacja publiczna', ''],
        // Wiersz 17
        ['9.', '711', 'Sprzedaż kalendarzy', '', '', '9.', '412', 'Koszty utrzymania samochodu, paliwo itd.', ''],
        // Wiersz 18
        ['10.', '714', 'Pensje, emerytury i renty', '', '', '10.', '413', 'Noclegi', ''],
        // Wiersz 19
        ['11.', '715', 'Zwroty', '', '', '11.', '421', 'Osobiste, higiena osobista', ''],
        // Wiersz 20
        ['12.', '717', 'Inne', '', '', '12.', '423', 'Formacja ustawiczna', ''],
        // Wiersz 21
        ['', '', '', '', '', '13.', '424', 'Leczenie, opieka zdrowotna', ''],
        // Wiersz 22
        ['', '', '', '', '', '14.', '430', 'Kult', ''],
        // Wiersz 23
        ['', '', '', '', '', '15.', '431', 'Książki, gazety, czasopisma, prenumeraty', ''],
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      
      // Szerokości kolumn A-I
      ws['!cols'] = [
        { wch: 4 },   // A - LP
        { wch: 6 },   // B - Konto
        { wch: 40 },  // C - Opis
        { wch: 4 },   // D - separator/etykieta
        { wch: 12 },  // E - Kwota przychody
        { wch: 4 },   // F - LP rozchody
        { wch: 6 },   // G - Konto rozchody
        { wch: 45 },  // H - Opis rozchody
        { wch: 12 },  // I - Kwota rozchody
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Rozliczenie');
      XLSX.writeFile(wb, 'szablon_rozliczen.xlsx');
      
      toast({
        title: "Szablon pobrany",
        description: "Szablon formularza rozliczeń Excel został pobrany",
      });
    });
  };

  const downloadCsvTemplate = () => {
    const csvContent = `Furta;"6.020,00";420-1-1-1;"6.020,00";100
Kuchnia;"33.480,00";420-1-1-2;"33.480,00";100
Pralnia;"4.500,00";420-1-1-3;"4.500,00";100
Warsztat;"8.720,00";420-1-1-4;"8.720,00";100
Inne;"6.900,00";420-1-1-5;"6.900,00";100
Kiosk;"11.700,00";420-1-3-1;"11.700,00";100
Kawiarnia;"11.580,00";420-1-3-2;"11.580,00";100
Jadłodajnia;"32.090,00";420-1-3-3;"32.090,00";100
WC;"0,00";420-1-3-4;"0,00";100
Krypty;"6.840,00";420-1-3-5;"6.840,00";100
Wieża;"4.800,00";420-1-3-6;"4.800,00";100
`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'szablon_importu.csv';
    link.click();
    
    toast({
      title: "Szablon pobrany",
      description: "Szablon CSV został pobrany",
    });
  };

  const downloadMt940Template = () => {
    const mt940Content = `
:20:1
:25:/PL69124013721111000012494387
:28C:00065
:60F:C250614PLN000000224791,09
:61:2506160616CN000000058400,00N172NONREF
:86:172^00PRZELEW                    ^34000
^3012404416^38PL95124044161111001083941985
^20Przelew środków
^32DOM ZAKONNY MISJONARZY OBLATÓW     ŚWIĘTY KRZYŻ 1
^6226-006    NOWA SŁUPIA      ^63   PL
:61:2506160616DN000000000447,30N775NONREF
:86:775^00PRZELEW INTERNET M/B       ^34000
^3011402004^38PL81114020040000350231273820
^20Numer zamówienia:…284356
^32Wydawnictwo, Księgarnia, Antykwariat Górski FILAR Henr
^62yk RĄCZKA
:61:2506160616DN000000025707,00N631NONREF
:86:631^00PRZELEW BETA/INTEGRA       ^34000
^3012404416^38PL61124044161111001085264998
^20zasilenie konta (- rewitalizacja)
^32DOM ZAKONNY MISJONARZY OBLATÓW     ŚWIĘTY KRZYŻ 1
^6226-006 NOWA SŁUPIA
:62F:C250616PLN000000257036,79
:64:C250616PLN000000257036,79
-
`;
    
    const blob = new Blob([mt940Content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'szablon_mt940.txt';
    link.click();
    
    toast({
      title: "Szablon pobrany",
      description: "Szablon MT940 został pobrany",
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dokumenty</h1>
            <div className="flex gap-2">
              <Button onClick={handleSearchAccounts} variant="outline" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Wyszukaj konta
              </Button>
              <Button onClick={() => navigate('/kpir')} variant="outline" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Wyszukaj operacje
              </Button>
              <Button 
                onClick={() => setIsImportSectionOpen(!isImportSectionOpen)} 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <FileUp className="h-4 w-4" />
                Import z pliku
                {isImportSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nowy dokument
              </Button>
            </div>
          </div>

          {isImportSectionOpen && (
            <div className="flex justify-end gap-2 p-4 bg-muted/50 rounded-lg border flex-wrap">
              <Button onClick={() => setIsExcelFormImportOpen(true)} variant="outline" size="sm" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Import Rozliczeń Excel
              </Button>
              <Button onClick={downloadExcelFormTemplate} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Szablon Rozliczeń
              </Button>
              <Button onClick={() => setIsCsvImportOpen(true)} variant="outline" size="sm" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={downloadCsvTemplate} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Szablon CSV
              </Button>
              <Button onClick={() => setIsMt940ImportOpen(true)} variant="outline" size="sm" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Import MT940
              </Button>
              <Button onClick={downloadMt940Template} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Szablon MT940
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          {isAdminOrProvincial && (
            <div className="w-64">
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie placówki" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">Wszystkie placówki</SelectItem>
                  {locations?.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Szukaj po numerze, nazwie, placówce lub dacie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        {/* Documents table */}
        <DocumentsTable
          documents={filteredDocuments}
          onDocumentClick={handleDocumentClick}
          onDocumentDelete={handleDocumentDelete}
          isLoading={isLoading}
        />

        {filteredDocuments.length === 0 && !isLoading && searchTerm && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nie znaleziono dokumentów
            </h3>
            <p className="text-gray-600 mb-4">
              Spróbuj zmienić kryteria wyszukiwania
            </p>
          </div>
        )}
      </div>

      <DocumentDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedDocument(null);
        }}
        onDocumentCreated={handleDocumentCreated}
        document={selectedDocument}
      />

      <Mt940ImportDialog
        open={isMt940ImportOpen}
        onClose={() => setIsMt940ImportOpen(false)}
        onImportComplete={handleMt940ImportComplete}
      />

      <CsvImportDialog
        open={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onImportComplete={handleCsvImportComplete}
      />

      <ExcelFormImportDialog
        open={isExcelFormImportOpen}
        onClose={() => setIsExcelFormImportOpen(false)}
        onImportComplete={handleExcelFormImportComplete}
      />
    </MainLayout>
  );
};

export default DocumentsPage;
