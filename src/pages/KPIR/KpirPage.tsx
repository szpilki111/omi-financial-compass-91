
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/button';
import { FilePlus2, Download, Upload, FileDown, FileUp, Search } from 'lucide-react';
import { format } from 'date-fns';
import KpirOperationDialog from './KpirOperationDialog';
import { KpirTransaction } from '@/types/kpir';
import KpirTable from './KpirTable';
import KpirImportDialog from './KpirImportDialog';
import { useLocation, useNavigate } from 'react-router-dom';
import KpirSummary from './components/KpirSummary';
import { calculateFinancialSummary } from '@/utils/financeUtils';

const KpirPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
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

  // Podsumowanie miesięczne
  const [monthlySummary, setMonthlySummary] = useState({
    income: 0,
    expense: 0,
    balance: 0
  });

  // Sprawdź, czy użytkownik jest adminem lub prowincjałem (nie może dodawać operacji)
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // Sprawdź, czy jesteśmy na ścieżce /kpir/nowy i otwórz okno nowej operacji
  useEffect(() => {
    if (location.pathname === '/kpir/nowy') {
      setShowNewOperationDialog(true);
    }
  }, [location.pathname]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Użyj nowej funkcji do obliczania podsumowania finansowego
      const locationId = user?.location || undefined;
      const summary = await calculateFinancialSummary(
        locationId,
        filters.dateFrom,
        filters.dateTo
      );

      setTransactions(summary.transactions);
      setMonthlySummary({
        income: summary.income,
        expense: summary.expense,
        balance: summary.balance
      });

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
    // Jeśli byliśmy na ścieżce /kpir/nowy, wróć do głównej strony KPIR
    if (location.pathname === '/kpir/nowy') {
      navigate('/kpir');
    }
    fetchTransactions();
    toast({
      title: "Sukces",
      description: "Operacja została dodana",
    });
  };

  const handleDialogClose = () => {
    setShowNewOperationDialog(false);
    // Jeśli byliśmy na ścieżce /kpir/nowy, wróć do głównej strony KPIR
    if (location.pathname === '/kpir/nowy') {
      navigate('/kpir');
    }
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
          {/* Przycisk "Nowa operacja" tylko dla ekonomów */}
          {!isAdmin && (
            <div className="flex gap-2">
              <Button onClick={handleNewOperation} className="bg-omi-500">
                <FilePlus2 className="mr-2 h-4 w-4" />
                Nowa operacja
              </Button>
            </div>
          )}
        </div>

        {/* Podsumowanie miesięczne */}
        <KpirSummary 
          income={monthlySummary.income}
          expense={monthlySummary.expense}
          balance={monthlySummary.balance}
        />

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
            
            {/* Przyciski akcji - Import i Eksport tylko dla ekonomów */}
            {!isAdmin && (
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
            )}
          </div>
          
          <KpirTable transactions={transactions} loading={loading} />
        </div>
      </div>

      {/* Dialog do dodawania nowej operacji - tylko dla ekonomów */}
      {!isAdmin && showNewOperationDialog && (
        <KpirOperationDialog 
          open={showNewOperationDialog}
          onClose={handleDialogClose}
          onSave={handleOperationAdded}
        />
      )}

      {/* Dialog do importowania operacji - tylko dla ekonomów */}
      {!isAdmin && showImportDialog && (
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
