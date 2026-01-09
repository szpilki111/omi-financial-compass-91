import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, TrendingUp, Eye, X, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { useFilteredAccounts } from '@/hooks/useFilteredAccounts';
import AccountSelector from './AccountSelector';
import TransactionsList from './TransactionsList';
import MonthlyTurnoverView from './MonthlyTurnoverView';
import PrintableAccountTurnover from './PrintableAccountTurnover';
import DocumentDialog from '@/pages/Documents/DocumentDialog';


interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  date: string;
  document_number: string;
  description: string;
  amount: number;
  debit_amount?: number;
  credit_amount?: number;
  debit_account_id: string;
  credit_account_id: string;
  settlement_type: string;
  document_id: string | null;
  document?: {
    id: string;
    document_number: string;
    document_name: string;
  };
  debitAccount?: Account;
  creditAccount?: Account;
}

const AccountSearchPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showTurnover, setShowTurnover] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Use central hook for fetching accounts with restrictions applied
  const { data: allFilteredAccounts = [] } = useFilteredAccounts();

  // Filter accounts by search term (client-side)
  const accounts = useMemo(() => {
    if (searchTerm.length < 2 || selectedAccount) return [];
    
    const searchLower = searchTerm.toLowerCase();
    return allFilteredAccounts.filter(account => 
      account.number.toLowerCase().startsWith(searchLower) ||
      account.name.toLowerCase().includes(searchLower)
    );
  }, [allFilteredAccounts, searchTerm, selectedAccount]);

  // Fetch transactions for selected account
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['account-transactions', selectedAccount?.id, selectedYear],
    queryFn: async () => {
      if (!selectedAccount) return [];
      
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          document:documents(id, document_number, document_name),
          debitAccount:accounts!transactions_debit_account_id_fkey(id, number, name, type),
          creditAccount:accounts!transactions_credit_account_id_fkey(id, number, name, type)
        `)
        .or(`debit_account_id.eq.${selectedAccount.id},credit_account_id.eq.${selectedAccount.id}`)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!selectedAccount,
  });

  // Fetch document for editing
  const { data: documentData } = useQuery({
    queryKey: ['document', editingDocument?.id],
    queryFn: async () => {
      if (!editingDocument?.id) return null;
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', editingDocument.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!editingDocument?.id,
  });

  // Calculate totals - NAPRAWIONE zliczanie
  const totals = useMemo(() => {
    if (!transactions || !selectedAccount) return { debit: 0, credit: 0, balance: 0 };
    
    let debitTotal = 0;
    let creditTotal = 0;
    
    transactions.forEach(transaction => {
      // Jeśli konto jest po stronie Wn (debit)
      if (transaction.debit_account_id === selectedAccount.id) {
        // Użyj debit_amount jeśli jest, w przeciwnym razie amount
        const amount = transaction.debit_amount ?? transaction.amount ?? 0;
        debitTotal += amount;
      }
      // Jeśli konto jest po stronie Ma (credit)
      if (transaction.credit_account_id === selectedAccount.id) {
        // Użyj credit_amount jeśli jest, w przeciwnym razie amount
        const amount = transaction.credit_amount ?? transaction.amount ?? 0;
        creditTotal += amount;
      }
    });
    
    return {
      debit: debitTotal,
      credit: creditTotal,
      balance: debitTotal - creditTotal
    };
  }, [transactions, selectedAccount]);

  // Group transactions by month - NAPRAWIONE zliczanie
  const monthlyData = useMemo(() => {
    if (!transactions || !selectedAccount) return [];
    
    const grouped = transactions.reduce((acc, transaction) => {
      const month = format(parseISO(transaction.date), 'yyyy-MM');
      if (!acc[month]) {
        acc[month] = {
          month,
          monthName: format(parseISO(transaction.date), 'LLLL yyyy', { locale: pl }),
          transactions: [],
          debit: 0,
          credit: 0
        };
      }
      
      acc[month].transactions.push(transaction);
      
      // NAPRAWIONE: użyj debit_amount/credit_amount zamiast amount
      if (transaction.debit_account_id === selectedAccount.id) {
        acc[month].debit += transaction.debit_amount ?? transaction.amount ?? 0;
      }
      if (transaction.credit_account_id === selectedAccount.id) {
        acc[month].credit += transaction.credit_amount ?? transaction.amount ?? 0;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped).sort((a: any, b: any) => b.month.localeCompare(a.month));
  }, [transactions, selectedAccount]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (selectedMonth === null) return transactions;
    
    return transactions.filter(transaction => {
      const transactionMonth = new Date(transaction.date).getMonth() + 1;
      return transactionMonth === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setSearchTerm(`${account.number} - ${account.name}`);
  };

  const handleClearSelection = () => {
    setSelectedAccount(null);
    setSearchTerm('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
      setSelectedAccount(null);
    }
  };

  const handleEditDocument = async (documentId: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (error) throw error;
      
      setEditingDocument(data);
      setIsDocumentDialogOpen(true);
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  const handleDocumentUpdated = () => {
    if (selectedAccount) {
      window.location.reload();
    }
    setIsDocumentDialogOpen(false);
    setEditingDocument(null);
  };

  const handleCloseDocumentDialog = () => {
    setIsDocumentDialogOpen(false);
    setEditingDocument(null);
  };

  // Drukowanie obrotów
  const handlePrint = () => {
    if (printRef.current) {
      // Create print overlay directly in body
      const printOverlay = document.createElement('div');
      printOverlay.className = 'print-overlay';
      printOverlay.innerHTML = printRef.current.innerHTML;
      document.body.appendChild(printOverlay);
      
      window.print();
      
      // Clean up after print
      document.body.removeChild(printOverlay);
    }
  };

  // Pobierz nazwę lokalizacji użytkownika
  const locationName = user?.locations?.[0] ? 'Lokalizacja użytkownika' : undefined;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dokumenty')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Powrót do dokumentów
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Wyszukiwanie kont</h1>
        </div>

        {/* Account search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Wyszukaj konto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Numer lub nazwa konta</label>
                <div className="relative">
                  <Input
                    placeholder="Wpisz co najmniej 2 znaki (numer lub nazwa)..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  {selectedAccount && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Rok</label>
                <Input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>
            
            {accounts && accounts.length > 0 && !selectedAccount && (
              <AccountSelector
                accounts={accounts}
                selectedAccount={selectedAccount}
                onSelectAccount={handleSelectAccount}
              />
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {selectedAccount && (
          <>
            {/* Account info header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Konto: {selectedAccount.number} - {selectedAccount.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedAccount.type}</Badge>
                    <Badge variant="secondary">{transactions?.length || 0} operacji</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* View toggle buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={!showTurnover ? "default" : "outline"}
                onClick={() => {
                  setShowTurnover(false);
                  setSelectedMonth(null);
                }}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Wszystkie operacje
              </Button>
              <Button
                variant={showTurnover ? "default" : "outline"}
                onClick={() => setShowTurnover(true)}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Obroty miesięczne
              </Button>
              <Button
                variant="outline"
                onClick={handlePrint}
                className="flex items-center gap-2 ml-auto"
              >
                <Printer className="h-4 w-4" />
                Drukuj obroty
              </Button>
            </div>

            {/* Content based on view mode */}
            {showTurnover ? (
              <MonthlyTurnoverView
                monthlyData={monthlyData}
                selectedAccount={selectedAccount}
                onViewMonth={(month) => {
                  setSelectedMonth(month);
                  setShowTurnover(false);
                }}
              />
            ) : (
              <TransactionsList
                transactions={filteredTransactions}
                selectedAccount={selectedAccount}
                isLoading={transactionsLoading}
                onEditDocument={handleEditDocument}
                selectedMonth={selectedMonth}
                onClearMonthFilter={() => setSelectedMonth(null)}
              />
            )}

            {/* Account totals at the bottom */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Obroty debetowe (Wn)</p>
                    <p className="text-2xl font-bold text-red-600">
                      {totals.debit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Obroty kredytowe (Ma)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {totals.credit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Saldo ({selectedYear})</p>
                    <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totals.balance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Printable component (hidden) */}
      {selectedAccount && transactions && (
        <PrintableAccountTurnover
          ref={printRef}
          account={selectedAccount}
          transactions={transactions}
          year={selectedYear}
          totals={totals}
          locationName={locationName}
        />
      )}

      {/* Document Dialog */}
      <DocumentDialog
        isOpen={isDocumentDialogOpen}
        onClose={handleCloseDocumentDialog}
        onDocumentCreated={handleDocumentUpdated}
        document={documentData}
      />
    </MainLayout>
  );
};

export default AccountSearchPage;
