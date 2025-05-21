
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/button';
import { FilePlus2, Download, Upload, FileDown, FileUp, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import KpirOperationDialog from './KpirOperationDialog';
import { KpirTransaction } from '@/types/kpir';
import KpirTable from './KpirTable';
import KpirImportDialog from './KpirImportDialog';

const KpirPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<KpirTransaction[]>([]);
  const [showNewOperationDialog, setShowNewOperationDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Stan filtrów
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          document_number,
          description,
          amount,
          debit_account_id,
          credit_account_id,
          settlement_type,
          currency,
          exchange_rate,
          location_id
        `)
        .order('date', { ascending: false });

      // Filtr po lokalizacji dla ekonomów
      if (user && user.role === 'ekonom' && user.location) {
        query = query.eq('location_id', user.location);
      }

      // Zastosuj filtr daty od
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      
      // Zastosuj filtr daty do
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      // Zastosuj wyszukiwanie po opisie lub numerze dokumentu
      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,document_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Pobierz informacje o kontach, aby móc wyświetlić nazwy zamiast ID
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, number, name');

      if (accountsError) {
        throw accountsError;
      }

      const accountsMap = new Map(accounts.map((acc: any) => [acc.id, { number: acc.number, name: acc.name }]));

      const formattedTransactions: KpirTransaction[] = data.map((transaction: any) => ({
        ...transaction,
        debitAccount: accountsMap.get(transaction.debit_account_id) || { number: 'Nieznane', name: 'Nieznane konto' },
        creditAccount: accountsMap.get(transaction.credit_account_id) || { number: 'Nieznane', name: 'Nieznane konto' },
        formattedDate: format(new Date(transaction.date), 'dd.MM.yyyy'),
        // Ensure settlement_type is always one of the allowed values
        settlement_type: (transaction.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek')
      }));

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Błąd podczas pobierania transakcji:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać listy operacji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user, filters]);

  const handleNewOperation = () => {
    setShowNewOperationDialog(true);
  };

  const handleImport = () => {
    setShowImportDialog(true);
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    toast({
      title: "Eksport",
      description: `Eksport danych do formatu ${format.toUpperCase()} zostanie zaimplementowany wkrótce`,
    });
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleOperationAdded = () => {
    setShowNewOperationDialog(false);
    fetchTransactions();
    toast({
      title: "Sukces",
      description: "Operacja została dodana",
    });
  };

  const handleImportComplete = (count: number) => {
    setShowImportDialog(false);
    fetchTransactions();
    toast({
      title: "Import zakończony",
      description: `Zaimportowano ${count} operacji`,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <PageTitle 
            title="Księga Przychodów i Rozchodów"
            subtitle="Przeglądaj i zarządzaj operacjami finansowymi"
          />
          <div className="flex gap-2">
            <Button onClick={handleNewOperation} className="bg-omi-500">
              <FilePlus2 className="mr-2 h-4 w-4" />
              Nowa operacja
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-omi-gray-200">
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
            {/* Filtry */}
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="flex gap-2 flex-1">
                <div className="flex-1">
                  <label htmlFor="dateFrom" className="block text-sm font-medium text-omi-gray-700 mb-1">
                    Data od
                  </label>
                  <input
                    type="date"
                    id="dateFrom"
                    name="dateFrom"
                    value={filters.dateFrom}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-omi-gray-300 rounded-md"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="dateTo" className="block text-sm font-medium text-omi-gray-700 mb-1">
                    Data do
                  </label>
                  <input
                    type="date"
                    id="dateTo"
                    name="dateTo"
                    value={filters.dateTo}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-omi-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex-1 flex items-end">
                <div className="relative flex-1">
                  <label htmlFor="search" className="block text-sm font-medium text-omi-gray-700 mb-1">
                    Wyszukaj
                  </label>
                  <input
                    type="text"
                    id="search"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Numer dokumentu, opis..."
                    className="w-full p-2 border border-omi-gray-300 rounded-md pr-10"
                  />
                  <button 
                    type="submit" 
                    className="absolute right-2 bottom-2 text-omi-gray-500 hover:text-omi-500"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </form>
            
            {/* Przyciski akcji */}
            <div className="flex gap-2 items-end">
              <Button variant="outline" onClick={handleImport}>
                <FileUp className="mr-2 h-4 w-4" />
                Importuj
              </Button>
              <Button variant="outline" onClick={() => handleExport('excel')}>
                <FileDown className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport('pdf')}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
          
          <KpirTable transactions={transactions} loading={loading} />
        </div>
      </div>

      {/* Dialog do dodawania nowej operacji */}
      {showNewOperationDialog && (
        <KpirOperationDialog 
          open={showNewOperationDialog}
          onClose={() => setShowNewOperationDialog(false)}
          onSave={handleOperationAdded}
        />
      )}

      {/* Dialog do importowania operacji */}
      {showImportDialog && (
        <KpirImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </MainLayout>
  );
};

export default KpirPage;

