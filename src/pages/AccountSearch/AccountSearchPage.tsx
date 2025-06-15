import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, TrendingUp, Eye, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import AccountSelector from './AccountSelector';
import TransactionsList from './TransactionsList';
import MonthlyTurnoverView from './MonthlyTurnoverView';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showTurnover, setShowTurnover] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .ilike('number', `${searchTerm}%`)
        .order('number');
      
      if (error) throw error;
      return data as Account[];
    },
    enabled: searchTerm.length >= 2,
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

  const handleEditDocument = (documentId: string) => {
    navigate(`/dokumenty?edit=${documentId}`);
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
                <Input
                  placeholder="Wpisz co najmniej 2 cyfry..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
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
            
            {accounts && accounts.length > 0 && (
              <AccountSelector
                accounts={accounts}
                selectedAccount={selectedAccount}
                onSelectAccount={setSelectedAccount}
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
    </MainLayout>
  );
};

export default AccountSearchPage;
