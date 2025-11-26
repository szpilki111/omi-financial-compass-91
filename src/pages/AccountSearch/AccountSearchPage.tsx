import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, TrendingUp, Eye, Edit, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import AccountSelector from './AccountSelector';
import TransactionsList from './TransactionsList';
import MonthlyTurnoverView from './MonthlyTurnoverView';
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

  // Get user's location
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('location_id')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch accounts filtered by location
  const { data: accounts } = useQuery({
    queryKey: ['accounts', searchTerm, userProfile?.location_id],
    queryFn: async () => {
      if (searchTerm.length < 2 || !userProfile?.location_id) return [];
      
      // Get location identifier
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', userProfile.location_id)
        .single();

      if (locationError) {
        console.error('Error fetching location:', locationError);
        return [];
      }

      const locationCategory = locationData?.location_identifier?.split('-')[0];

      // Get account restrictions for this category
      let restrictions: any[] = [];
      if (locationCategory) {
        const { data: restrictionsData } = await supabase
          .from('account_category_restrictions')
          .select('*')
          .eq('category_prefix', locationCategory)
          .eq('is_restricted', true);

        restrictions = restrictionsData || [];
      }

      // Get manually assigned accounts
      const { data: locationAccountData } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', userProfile.location_id);

      const accountIds = locationAccountData?.map(la => la.account_id) || [];

      // Get all accounts
      let query = supabase
        .from('accounts')
        .select('*')
        .ilike('number', `${searchTerm}%`)
        .order('number');

      const { data: allAccounts, error } = await query;
      
      if (error) throw error;
      
      let filteredAccounts = allAccounts || [];

      // Filter to only include:
      // 1. Manually assigned accounts
      // 2. Accounts matching location identifier pattern
      if (locationData?.location_identifier) {
        filteredAccounts = filteredAccounts.filter(account => {
          // Check if manually assigned
          if (accountIds.includes(account.id)) return true;

          // Check if matches location identifier pattern
          const accountParts = account.number.split('-');
          if (accountParts.length < 2) return false;
          
          const suffix = accountParts.slice(1).join('-');
          const identifier = locationData.location_identifier;
          return suffix === identifier || suffix.startsWith(identifier + '-');
        });
      } else {
        // If no identifier, only show manually assigned accounts
        filteredAccounts = filteredAccounts.filter(account => 
          accountIds.includes(account.id)
        );
      }

      // Apply category restrictions
      if (locationCategory && restrictions.length > 0) {
        const restrictedPrefixes = restrictions.map(r => r.account_number_prefix);
        filteredAccounts = filteredAccounts.filter(account => {
          const parts = account.number.split('-');
          const accountPrefix = parts[0];
          return !restrictedPrefixes.includes(accountPrefix);
        });
      }

      return filteredAccounts as Account[];
    },
    enabled: searchTerm.length >= 2 && !selectedAccount && !!userProfile?.location_id,
  });

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
  const { data: documentData, refetch: refetchDocument } = useQuery({
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

  // Calculate totals
  const totals = useMemo(() => {
    if (!transactions || !selectedAccount) return { debit: 0, credit: 0, balance: 0 };
    
    let debitTotal = 0;
    let creditTotal = 0;
    
    transactions.forEach(transaction => {
      if (transaction.debit_account_id === selectedAccount.id) {
        debitTotal += transaction.amount;
      }
      if (transaction.credit_account_id === selectedAccount.id) {
        creditTotal += transaction.amount;
      }
    });
    
    return {
      debit: debitTotal,
      credit: creditTotal,
      balance: debitTotal - creditTotal
    };
  }, [transactions, selectedAccount]);

  // Group transactions by month
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
      
      if (transaction.debit_account_id === selectedAccount.id) {
        acc[month].debit += transaction.amount;
      }
      if (transaction.credit_account_id === selectedAccount.id) {
        acc[month].credit += transaction.amount;
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
    
    // If user modifies the search term and we have a selected account, clear it
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
    // Refresh the transactions list after document update
    if (selectedAccount) {
      // This will trigger a refetch of the transactions query
      window.location.reload();
    }
    setIsDocumentDialogOpen(false);
    setEditingDocument(null);
  };

  const handleCloseDocumentDialog = () => {
    setIsDocumentDialogOpen(false);
    setEditingDocument(null);
  };

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
                <label className="block text-sm font-medium mb-2">Numer konta</label>
                <div className="relative">
                  <Input
                    placeholder="Wpisz co najmniej 2 cyfry..."
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
                  <Badge variant="outline">{selectedAccount.type}</Badge>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* View toggle buttons */}
            <div className="flex gap-2">
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
                    <p className="text-sm text-gray-600">Obroty debetowe</p>
                    <p className="text-2xl font-bold text-red-600">
                      {totals.debit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Obroty kredytowe</p>
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
