import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Search, FileText, Calendar, MapPin, TrendingUp, TrendingDown, Edit, BarChart3, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import AccountNameEditDialog from './AccountNameEditDialog';
import MonthlyTurnoversDialog from './MonthlyTurnoversDialog';
import OperationDetailsDialog from './OperationDetailsDialog';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  location: {
    name: string;
  };
}

interface Transaction {
  id: string;
  document_id: string | null;
  debit_account_id: string;
  credit_account_id: string;
  description: string;
  amount: number;
  date: string;
  location: { name: string } | null;
  document: {
    document_number: string;
    type: string;
  } | null;
}

interface Operation {
  id: string;
  document_id: string | null;
  account_number: string;
  description: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  date: string;
  location: { name: string } | null;
  document: {
    document_number: string;
    type: string;
  } | null;
}

const AccountSearchPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [turnoversDialogOpen, setTurnoversDialogOpen] = useState(false);
  const [operationDetailsOpen, setOperationDetailsOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Check if user can edit account names
  const canEditAccountNames = user?.role === 'admin' || user?.role === 'prowincjal';

  const searchAccounts = async () => {
    if (!searchTerm.trim()) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          id,
          number,
          name,
          type,
          created_at,
          updated_at,
          location:locations!inner(name)
        `)
        .or(`number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .order('number');

      if (accountsError) throw accountsError;

      const transformedAccounts = (accountsData || []).map(account => ({
        ...account,
        location: Array.isArray(account.location) ? account.location[0] : account.location
      }));

      setAccounts(transformedAccounts);
    } catch (error: any) {
      console.error('Error searching accounts:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się wyszukać kont",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectAccount = async (account: Account) => {
    setSelectedAccount(account);
    setOperationsLoading(true);
    
    try {
      // Pobierz transakcje gdzie konto występuje jako debit lub credit
      const { data: transactionsData, error } = await supabase
        .from('transactions')
        .select(`
          id,
          document_id,
          debit_account_id,
          credit_account_id,
          description,
          amount,
          date,
          location:locations(name),
          document:documents(document_number, type)
        `)
        .or(`debit_account_id.eq.${account.id},credit_account_id.eq.${account.id}`)
        .order('date', { ascending: false });

      if (error) throw error;
      
      // Transform transactions to operations
      const operations: Operation[] = (transactionsData || []).map(transaction => {
        const isDebit = transaction.debit_account_id === account.id;
        return {
          id: transaction.id,
          document_id: transaction.document_id,
          account_number: account.number,
          description: transaction.description,
          amount: transaction.amount,
          transaction_type: isDebit ? 'expense' : 'income',
          date: transaction.date,
          location: Array.isArray(transaction.location) ? transaction.location[0] : transaction.location,
          document: Array.isArray(transaction.document) ? transaction.document[0] : transaction.document
        };
      });

      setOperations(operations);
    } catch (error: any) {
      console.error('Error fetching operations:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać operacji dla tego konta",
        variant: "destructive",
      });
    } finally {
      setOperationsLoading(false);
    }
  };

  const handleEditAccountName = (account: Account) => {
    setAccountToEdit(account);
    setEditDialogOpen(true);
  };

  const handleAccountUpdated = (updatedAccount: Account) => {
    setAccounts(accounts.map(acc => 
      acc.id === updatedAccount.id ? updatedAccount : acc
    ));
    
    if (selectedAccount?.id === updatedAccount.id) {
      setSelectedAccount(updatedAccount);
    }
  };

  const handleShowTurnovers = () => {
    setTurnoversDialogOpen(true);
  };

  const handleShowOperationDetails = (operation: Operation) => {
    setSelectedOperation(operation);
    setOperationDetailsOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const getCurrentYearOperations = () => {
    return operations.filter(op => new Date(op.date).getFullYear() === selectedYear);
  };

  const getTotalAmount = () => {
    const yearOperations = getCurrentYearOperations();
    return yearOperations.reduce((sum, op) => {
      return sum + (op.transaction_type === 'income' ? op.amount : -op.amount);
    }, 0);
  };

  const getIncomeTotal = () => {
    const yearOperations = getCurrentYearOperations();
    return yearOperations
      .filter(op => op.transaction_type === 'income')
      .reduce((sum, op) => sum + op.amount, 0);
  };

  const getExpenseTotal = () => {
    const yearOperations = getCurrentYearOperations();
    return yearOperations
      .filter(op => op.transaction_type === 'expense')
      .reduce((sum, op) => sum + op.amount, 0);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle title="Wyszukiwanie kont" />

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Wyszukaj konto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Wprowadź numer lub nazwę konta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchAccounts()}
              />
              <Button onClick={searchAccounts} disabled={loading}>
                {loading ? 'Szukam...' : 'Szukaj'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Accounts List */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Znalezione konta ({accounts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedAccount?.id === account.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => selectAccount(account)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.number}</span>
                          <Badge variant="outline">{account.type}</Badge>
                        </div>
                        <p className="text-gray-600">{account.name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {account.location?.name || 'Brak lokalizacji'}
                        </p>
                      </div>
                      {canEditAccountNames && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAccountName(account);
                          }}
                          className="ml-2"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Account Operations */}
        {selectedAccount && (
          <div className="space-y-4">
            {/* Year Selector and Turnovers Button */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Rok:</label>
                    <select 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="border rounded px-3 py-1"
                    >
                      {[2024, 2023, 2022, 2021, 2020].map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={handleShowTurnovers} className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Obroty
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Łączne przychody {selectedYear}</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(getIncomeTotal())}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Łączne rozchody {selectedYear}</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(getExpenseTotal())}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Saldo {selectedYear}</p>
                      <p className={`text-2xl font-bold ${getTotalAmount() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(getTotalAmount())}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Operations List */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Operacje dla konta {selectedAccount.number} - {selectedAccount.name} ({selectedYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {operationsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Ładowanie operacji...</p>
                  </div>
                ) : getCurrentYearOperations().length > 0 ? (
                  <div className="space-y-2">
                    {getCurrentYearOperations().map((operation) => (
                      <div key={operation.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={operation.transaction_type === 'income' ? 'default' : 'destructive'}>
                                {operation.transaction_type === 'income' ? 'Przychód' : 'Rozchód'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {operation.document?.document_number || 'Brak numeru'}
                              </span>
                            </div>
                            <p className="font-medium">{operation.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(operation.date), 'dd.MM.yyyy', { locale: pl })}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {operation.location?.name || 'Brak lokalizacji'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowOperationDetails(operation)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${
                                operation.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {operation.transaction_type === 'income' ? '+' : '-'}{formatCurrency(operation.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Brak operacji dla tego konta w {selectedYear} roku</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dialogs */}
        <AccountNameEditDialog
          account={accountToEdit}
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setAccountToEdit(null);
          }}
          onAccountUpdated={handleAccountUpdated}
        />

        <MonthlyTurnoversDialog
          account={selectedAccount}
          operations={getCurrentYearOperations()}
          year={selectedYear}
          isOpen={turnoversDialogOpen}
          onClose={() => setTurnoversDialogOpen(false)}
        />

        <OperationDetailsDialog
          operation={selectedOperation}
          isOpen={operationDetailsOpen}
          onClose={() => {
            setOperationDetailsOpen(false);
            setSelectedOperation(null);
          }}
        />
      </div>
    </MainLayout>
  );
};

export default AccountSearchPage;
