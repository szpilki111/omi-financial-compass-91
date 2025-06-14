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
import KpirEditDialog from './KpirEditDialog';
import KpirDocumentDialog from './KpirDocumentDialog';
import { KpirTransaction } from '@/types/kpir';
import KpirTable from './KpirTable';
import KpirImportDialog from './KpirImportDialog';
import { useLocation, useNavigate } from 'react-router-dom';
import { calculateFinancialSummary } from '@/utils/financeUtils';

const KpirPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<KpirTransaction[]>([]);
  const [showNewOperationDialog, setShowNewOperationDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<KpirTransaction | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<KpirTransaction["document"] | null>(null);
  
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
      let query = supabase
        .from('transactions')
        .select(`
          *,
          debitAccount:accounts!debit_account_id(number, name),
          creditAccount:accounts!credit_account_id(number, name),
          location:locations(name),
          parentTransaction:transactions!parent_transaction_id(id, description, document_number),
          document:documents(id, document_number, document_name, document_date)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // Filtrowanie według uprawnień użytkownika
      if (user?.role === 'ekonom' && user.location) {
        query = query.eq('location_id', user.location);
      }

      // Filtrowanie według dat
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      const { data: transactionsData, error } = await query;

      if (error) {
        console.error('Error fetching transactions:', error);
        throw error;
      }

      let filteredTransactions = transactionsData || [];

      // Filtrowanie według wyszukiwanej frazy
      if (filters.search.trim()) {
        const searchTerm = filters.search.trim().toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction => 
          transaction.description?.toLowerCase().includes(searchTerm) ||
          transaction.document_number?.toLowerCase().includes(searchTerm) ||
          transaction.debitAccount?.name?.toLowerCase().includes(searchTerm) ||
          transaction.creditAccount?.name?.toLowerCase().includes(searchTerm) ||
          transaction.debitAccount?.number?.toLowerCase().includes(searchTerm) ||
          transaction.creditAccount?.number?.toLowerCase().includes(searchTerm)
        );
      }

      // Mapowanie danych do odpowiedniego formatu
      const mappedTransactions = filteredTransactions.map(transaction => ({
        id: transaction.id,
        date: transaction.date,
        formattedDate: new Date(transaction.date).toLocaleDateString('pl-PL'),
        document_number: transaction.document_number,
        description: transaction.description,
        amount: parseFloat(transaction.amount.toString()),
        debit_account_id: transaction.debit_account_id,
        credit_account_id: transaction.credit_account_id,
        debitAccount: transaction.debitAccount,
        creditAccount: transaction.creditAccount,
        settlement_type: transaction.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek',
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate ? parseFloat(transaction.exchange_rate.toString()) : undefined,
        location: transaction.location,
        user_id: transaction.user_id,
        location_id: transaction.location_id,
        parent_transaction_id: transaction.parent_transaction_id,
        is_split_transaction: transaction.is_split_transaction || false,
        document: transaction.document || null,
      }));

      setTransactions(mappedTransactions);

      // Oblicz podsumowanie finansowe
      const locationId = user?.location || undefined;
      const summary = await calculateFinancialSummary(
        locationId,
        filters.dateFrom,
        filters.dateTo
      );

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

  const handleEditTransaction = (transaction: KpirTransaction) => {
    setSelectedTransaction(transaction);
    setShowEditDialog(true);
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
    // Wyszukiwanie jest teraz automatyczne poprzez useEffect
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

  const handleOperationUpdated = () => {
    setShowEditDialog(false);
    setSelectedTransaction(null);
    fetchTransactions();
    toast({
      title: "Sukces",
      description: "Operacja została zaktualizowana",
    });
  };

  const handleDialogClose = () => {
    setShowNewOperationDialog(false);
    // Jeśli byliśmy na ścieżce /kpir/nowy, wróć do głównej strony KPIR
    if (location.pathname === '/kpir/nowy') {
      navigate('/kpir');
    }
  };

  const handleEditDialogClose = () => {
    setShowEditDialog(false);
    setSelectedTransaction(null);
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
            title="Lista operacji"
            subtitle="Przeglądaj operacje"
          />
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
                    placeholder="Numer dokumentu, opis, konto..."
                    className="w-full p-2 border border-omi-gray-300 rounded-md pr-10"
                  />
                  <div className="absolute right-2 bottom-2 text-omi-gray-500">
                    <Search className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </form>
            
          </div>
          
          <KpirTable 
            transactions={transactions} 
            loading={loading} 
            onEditTransaction={handleEditTransaction}
            onShowDocument={(doc) => setSelectedDocument(doc)}
          />
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

      {/* Dialog do edycji operacji - tylko dla ekonomów */}
      {!isAdmin && showEditDialog && (
        <KpirEditDialog
          open={showEditDialog}
          onClose={handleEditDialogClose}
          onSave={handleOperationUpdated}
          transaction={selectedTransaction}
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

      {/* Dialog podglądu dokumentu */}
      <KpirDocumentDialog
        open={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        document={selectedDocument}
      />
    </MainLayout>
  );
};

export default KpirPage;
