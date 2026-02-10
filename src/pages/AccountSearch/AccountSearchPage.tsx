import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, TrendingUp, Eye, X, FileSpreadsheet, FilePlus } from 'lucide-react';
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
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

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
  currency?: string;
  exchange_rate?: number;
  document?: {
    id: string;
    document_number: string;
    document_name: string;
    currency?: string;
    exchange_rate?: number;
  };
  debitAccount?: Account;
  creditAccount?: Account;
}

const AccountSearchPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showTurnover, setShowTurnover] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
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

  // Fetch all related accounts (including analytical sub-accounts) for the selected account
  const { data: relatedAccountIds = [] } = useQuery({
    queryKey: ['related-accounts', selectedAccount?.number],
    queryFn: async () => {
      if (!selectedAccount) return [selectedAccount?.id];
      
      // Pobierz wszystkie konta zaczynające się od wybranego numeru (w tym samo konto i podkonta analityczne)
      const { data, error } = await supabase
        .from('accounts')
        .select('id')
        .or(`number.eq.${selectedAccount.number},number.like.${selectedAccount.number}-%`);
      
      if (error) throw error;
      return data?.map(a => a.id) || [selectedAccount.id];
    },
    enabled: !!selectedAccount
  });

  // Fetch transactions for selected account AND all its analytical sub-accounts
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['account-transactions', selectedAccount?.id, selectedYear, relatedAccountIds],
    queryFn: async () => {
      if (!selectedAccount || relatedAccountIds.length === 0) return [];
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      // Buduj warunek OR dla wszystkich powiązanych kont
      const orConditions = relatedAccountIds
        .flatMap(id => [`debit_account_id.eq.${id}`, `credit_account_id.eq.${id}`])
        .join(',');
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          document:documents(id, document_number, document_name, currency, exchange_rate),
          debitAccount:accounts!transactions_debit_account_id_fkey(id, number, name, type),
          creditAccount:accounts!transactions_credit_account_id_fkey(id, number, name, type)
        `)
        .or(orConditions)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!selectedAccount && relatedAccountIds.length > 0
  });

  // Fetch opening balance for the year (all transactions BEFORE the selected year) - including analytical sub-accounts
  const { data: openingBalanceForYear = 0 } = useQuery({
    queryKey: ['account-opening-balance', selectedAccount?.id, selectedYear, relatedAccountIds],
    queryFn: async () => {
      if (!selectedAccount || relatedAccountIds.length === 0) return 0;
      const endOfPrevYear = `${selectedYear - 1}-12-31`;
      
      // Buduj warunek OR dla wszystkich powiązanych kont
      const orConditions = relatedAccountIds
        .flatMap(id => [`debit_account_id.eq.${id}`, `credit_account_id.eq.${id}`])
        .join(',');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('debit_account_id, credit_account_id, debit_amount, credit_amount, amount')
        .or(orConditions)
        .lte('date', endOfPrevYear);
      
      if (error) throw error;
      
      // Tworzymy Set dla szybkiego sprawdzania
      const relatedAccountIdsSet = new Set(relatedAccountIds);
      
      let balance = 0;
      data?.forEach(tx => {
        if (relatedAccountIdsSet.has(tx.debit_account_id)) {
          balance += tx.debit_amount ?? tx.amount ?? 0;
        }
        if (relatedAccountIdsSet.has(tx.credit_account_id)) {
          balance -= tx.credit_amount ?? tx.amount ?? 0;
        }
      });
      
      return balance;
    },
    enabled: !!selectedAccount && relatedAccountIds.length > 0
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
    enabled: !!editingDocument?.id
  });

  // Calculate totals with opening and closing balance - uwzględnia wszystkie podkonta analityczne
  const totals = useMemo(() => {
    if (!transactions || !selectedAccount) return { 
      debit: 0, 
      credit: 0, 
      balance: 0,
      openingBalance: 0,
      closingBalance: 0
    };
    
    // Tworzymy Set dla szybkiego sprawdzania
    const relatedAccountIdsSet = new Set(relatedAccountIds);
    
    let debitTotal = 0;
    let creditTotal = 0;
    transactions.forEach(transaction => {
      // Sprawdzamy czy konto jest w zbiorze powiązanych kont (główne + analityczne)
      if (relatedAccountIdsSet.has(transaction.debit_account_id)) {
        const amount = transaction.debit_amount ?? transaction.amount ?? 0;
        debitTotal += amount;
      }
      if (relatedAccountIdsSet.has(transaction.credit_account_id)) {
        const amount = transaction.credit_amount ?? transaction.amount ?? 0;
        creditTotal += amount;
      }
    });
    
    const openingBalance = openingBalanceForYear;
    const closingBalance = openingBalance + debitTotal - creditTotal;
    
    return {
      debit: debitTotal,
      credit: creditTotal,
      balance: debitTotal - creditTotal,
      openingBalance,
      closingBalance
    };
  }, [transactions, selectedAccount, openingBalanceForYear, relatedAccountIds]);

  // Calculate currency-specific totals for non-PLN transactions
  const currencyTotals = useMemo(() => {
    if (!transactions || !selectedAccount) return new Map<string, { debit: number; credit: number }>();
    const relatedAccountIdsSet = new Set(relatedAccountIds);
    const map = new Map<string, { debit: number; credit: number }>();
    
    transactions.forEach(tx => {
      // Priorytet: waluta z dokumentu (autorytatywna), potem z transakcji
      const docCurrency = tx.document?.currency;
      const txCurrency = tx.currency;
      const currency = (docCurrency && docCurrency !== 'PLN') ? docCurrency 
                      : (txCurrency && txCurrency !== 'PLN') ? txCurrency 
                      : 'PLN';
      if (currency === 'PLN') return;
      
      if (!map.has(currency)) map.set(currency, { debit: 0, credit: 0 });
      const entry = map.get(currency)!;
      
      // Kwoty w oryginalnej walucie = kwota PLN / kurs wymiany
      const exchangeRate = tx.exchange_rate || tx.document?.exchange_rate || 1;
      
      if (relatedAccountIdsSet.has(tx.debit_account_id)) {
        const plnAmount = tx.debit_amount ?? tx.amount ?? 0;
        entry.debit += exchangeRate !== 1 ? plnAmount / exchangeRate : plnAmount;
      }
      if (relatedAccountIdsSet.has(tx.credit_account_id)) {
        const plnAmount = tx.credit_amount ?? tx.amount ?? 0;
        entry.credit += exchangeRate !== 1 ? plnAmount / exchangeRate : plnAmount;
      }
    });
    
    return map;
  }, [transactions, selectedAccount, relatedAccountIds]);

  // Group transactions by month - uwzględnia wszystkie podkonta analityczne
  const monthlyData = useMemo(() => {
    if (!transactions || !selectedAccount) return [];
    
    // Tworzymy Set dla szybkiego sprawdzania
    const relatedAccountIdsSet = new Set(relatedAccountIds);
    
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

      // Sprawdzamy czy konto jest w zbiorze powiązanych kont (główne + analityczne)
      if (relatedAccountIdsSet.has(transaction.debit_account_id)) {
        acc[month].debit += transaction.debit_amount ?? transaction.amount ?? 0;
      }
      if (relatedAccountIdsSet.has(transaction.credit_account_id)) {
        acc[month].credit += transaction.credit_amount ?? transaction.amount ?? 0;
      }
      return acc;
    }, {} as Record<string, any>);
    return Object.values(grouped).sort((a: any, b: any) => b.month.localeCompare(a.month));
  }, [transactions, selectedAccount, relatedAccountIds]);

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
    setSelectedTransactionIds([]);
  };

  const handleClearSelection = () => {
    setSelectedAccount(null);
    setSearchTerm('');
    setSelectedTransactionIds([]);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
      setSelectedAccount(null);
      setSelectedTransactionIds([]);
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
    queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
    setIsDocumentDialogOpen(false);
    setEditingDocument(null);
    setSelectedTransactionIds([]);
  };

  const handleCloseDocumentDialog = () => {
    setIsDocumentDialogOpen(false);
    setEditingDocument(null);
  };

  // Tworzenie dokumentu z zaznaczonych operacji
  const handleCreateDocumentFromSelected = async () => {
    if (!user?.id || !user?.location || selectedTransactionIds.length === 0) {
      toast({
        title: 'Błąd',
        description: 'Zaznacz operacje i upewnij się, że jesteś zalogowany',
        variant: 'destructive'
      });
      return;
    }

    setIsCreatingDocument(true);

    try {
      // Pobierz zaznaczone transakcje
      const selectedTransactions = transactions?.filter(t => 
        selectedTransactionIds.includes(t.id)
      ) || [];

      if (selectedTransactions.length === 0) {
        throw new Error('Brak zaznaczonych transakcji');
      }

      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      // Wygeneruj numer dokumentu
      const { data: docNumber, error: docNumberError } = await supabase
        .rpc('generate_document_number', {
          p_location_id: user.location,
          p_year: currentYear,
          p_month: currentMonth
        });

      if (docNumberError) throw docNumberError;

      // Utwórz dokument
      const { data: newDocument, error: docError } = await supabase
        .from('documents')
        .insert({
          document_number: docNumber,
          document_name: `Dokument z operacji konta ${selectedAccount?.number || ''}`,
          document_date: today.toISOString().split('T')[0],
          location_id: user.location,
          user_id: user.id,
          currency: 'PLN',
          exchange_rate: 1,
          validation_errors: JSON.stringify([{ type: 'missing_accounts', message: 'Brak przypisanych kont - uzupełnij' }])
        })
        .select()
        .single();

      if (docError) throw docError;

      // Utwórz transakcje bez przypisanych kont - dla rozbitych operacji odblokowujemy obie strony
      const transactionsToInsert = selectedTransactions.map((t, index) => {
        // Użyj większej kwoty jako wartości dla obu stron (dla rozbitych operacji)
        const amount = Math.max(t.debit_amount ?? 0, t.credit_amount ?? 0, t.amount ?? 0);
        
        return {
          document_id: newDocument.id,
          date: today.toISOString().split('T')[0],
          description: t.description || '',
          debit_amount: amount,   // ZAWSZE obie kwoty równe
          credit_amount: amount,  // Nie kopiuj "rozbitej" struktury
          debit_account_id: null,
          credit_account_id: null,
          currency: 'PLN',
          user_id: user.id,
          location_id: user.location,
          display_order: index + 1,
          is_parallel: false
          // NIE kopiuj is_split_transaction, parent_transaction_id itp.
        };
      });

      const { error: transError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (transError) throw transError;

      toast({
        title: 'Dokument utworzony',
        description: `Utworzono dokument ${docNumber} z ${selectedTransactions.length} operacjami. Uzupełnij konta.`
      });

      // Otwórz dokument do edycji
      setEditingDocument(newDocument);
      setIsDocumentDialogOpen(true);
      setSelectedTransactionIds([]);

    } catch (error: any) {
      console.error('Error creating document:', error);
      toast({
        title: 'Błąd tworzenia dokumentu',
        description: error.message || 'Nie udało się utworzyć dokumentu',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingDocument(false);
    }
  };

  // Eksport do Excela
  const handleExportToExcel = () => {
    if (!selectedAccount || !transactions) return;
    const wsData: (string | number | undefined)[][] = [];

    wsData.push([`Obroty konta: ${selectedAccount.number} - ${selectedAccount.name}`]);
    wsData.push([`Rok: ${selectedYear}`]);
    wsData.push([]);

    wsData.push(['Data', 'Nr dokumentu', 'Opis', 'Strona Wn', 'Strona Ma', 'Saldo bieżące']);

    let runningBalance = 0;
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    sortedTransactions.forEach(t => {
      const isDebit = t.debit_account_id === selectedAccount.id;
      const isCredit = t.credit_account_id === selectedAccount.id;
      const debitAmount = isDebit ? t.debit_amount ?? t.amount ?? 0 : 0;
      const creditAmount = isCredit ? t.credit_amount ?? t.amount ?? 0 : 0;
      runningBalance += debitAmount - creditAmount;
      wsData.push([
        format(parseISO(t.date), 'dd.MM.yyyy'),
        t.document_number || '-',
        t.description || '-',
        debitAmount || '',
        creditAmount || '',
        runningBalance
      ]);
    });

    wsData.push([]);
    wsData.push(['', '', 'RAZEM:', totals.debit, totals.credit, totals.balance]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Obroty');
    const fileName = `obroty_${selectedAccount.number.replace(/\//g, '-')}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({
      title: 'Eksport zakończony',
      description: `Plik ${fileName} został pobrany`
    });
  };

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
                  onChange={e => setSelectedYear(parseInt(e.target.value))} 
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
              
              <div className="flex gap-2 ml-auto">
                {selectedTransactionIds.length > 0 && (
                  <Button 
                    variant="default" 
                    onClick={handleCreateDocumentFromSelected}
                    disabled={isCreatingDocument}
                    className="flex items-center gap-2"
                  >
                    <FilePlus className="h-4 w-4" />
                    Utwórz dokument ({selectedTransactionIds.length})
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={handleExportToExcel} 
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Eksport do Excel
                </Button>
              </div>
            </div>

            {/* Summary card at TOP */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Saldo początkowe</p>
                    <p className={`text-2xl font-bold ${totals.openingBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {totals.openingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Obroty Wn</p>
                    <p className="text-2xl font-bold text-red-600">
                      {totals.debit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Obroty Ma</p>
                    <p className="text-2xl font-bold text-green-600">
                      {totals.credit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Saldo końcowe</p>
                    <p className={`text-2xl font-bold ${totals.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totals.closingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Currency-specific summaries - same 4-column layout as PLN */}
            {currencyTotals.size > 0 && Array.from(currencyTotals.entries()).map(([currency, data]) => (
              <Card key={currency}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Saldo początkowe ({currency})</p>
                      <p className="text-2xl font-bold text-blue-600">
                        — {currency}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Obroty Wn ({currency})</p>
                      <p className="text-2xl font-bold text-red-600">
                        {data.debit.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Obroty Ma ({currency})</p>
                      <p className="text-2xl font-bold text-green-600">
                        {data.credit.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Saldo końcowe ({currency})</p>
                      <p className={`text-2xl font-bold ${(data.debit - data.credit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(data.debit - data.credit).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Content based on view mode */}
            {showTurnover ? (
              <MonthlyTurnoverView 
                monthlyData={monthlyData} 
                selectedAccount={selectedAccount} 
                onViewMonth={month => {
                  setSelectedMonth(month);
                  setShowTurnover(false);
                }}
                openingBalanceForYear={openingBalanceForYear}
              />
            ) : (
              <TransactionsList 
                transactions={filteredTransactions} 
                selectedAccount={selectedAccount} 
                isLoading={transactionsLoading} 
                onEditDocument={handleEditDocument} 
                selectedMonth={selectedMonth} 
                onClearMonthFilter={() => setSelectedMonth(null)}
                selectedTransactionIds={selectedTransactionIds}
                onSelectionChange={setSelectedTransactionIds}
              />
            )}

            {/* Summary card at BOTTOM */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Saldo początkowe</p>
                    <p className={`text-2xl font-bold ${totals.openingBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {totals.openingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Obroty Wn</p>
                    <p className="text-2xl font-bold text-red-600">
                      {totals.debit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Obroty Ma</p>
                    <p className="text-2xl font-bold text-green-600">
                      {totals.credit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Saldo końcowe</p>
                    <p className={`text-2xl font-bold ${totals.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totals.closingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
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