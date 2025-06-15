
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
import { Search, FileText, Calendar, MapPin, TrendingUp, TrendingDown, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import AccountNameEditDialog from './AccountNameEditDialog';

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

interface Operation {
  id: string;
  document_id: string;
  account_number: string;
  description: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  date: string;
  location: { name: string };
  document: {
    document_number: string;
    type: string;
  };
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

  // Check if user can edit account names
  const canEditAccountNames = user?.role === 'admin' || user?.role === 'prowincjal';

  const searchAccounts = async () => {
    if (!searchTerm.trim()) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    try {
      // Search in the accounts table with location join
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

      // Transform the data to match our interface
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
      // Search for transactions related to this account
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          document_id,
          account_number,
          description,
          amount,
          transaction_type,
          date,
          location:locations(name),
          document:documents(document_number, type)
        `)
        .eq('account_number', account.number)
        .order('date', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedOperations = (data || []).map(operation => ({
        ...operation,
        location: Array.isArray(operation.location) ? operation.location[0] : operation.location,
        document: Array.isArray(operation.document) ? operation.document[0] : operation.document
      }));

      setOperations(transformedOperations);
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
    // Update accounts list
    setAccounts(accounts.map(acc => 
      acc.id === updatedAccount.id ? updatedAccount : acc
    ));
    
    // Update selected account if it's the one being edited
    if (selectedAccount?.id === updatedAccount.id) {
      setSelectedAccount(updatedAccount);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const getTotalAmount = () => {
    return operations.reduce((sum, op) => {
      return sum + (op.transaction_type === 'income' ? op.amount : -op.amount);
    }, 0);
  };

  const getIncomeTotal = () => {
    return operations
      .filter(op => op.transaction_type === 'income')
      .reduce((sum, op) => sum + op.amount, 0);
  };

  const getExpenseTotal = () => {
    return operations
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Łączne przychody</p>
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
                      <p className="text-sm font-medium text-gray-600">Łączne rozchody</p>
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
                      <p className="text-sm font-medium text-gray-600">Saldo</p>
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
                  Operacje dla konta {selectedAccount.number} - {selectedAccount.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {operationsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Ładowanie operacji...</p>
                  </div>
                ) : operations.length > 0 ? (
                  <div className="space-y-2">
                    {operations.map((operation) => (
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
                          <div className="text-right">
                            <p className={`text-lg font-bold ${
                              operation.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {operation.transaction_type === 'income' ? '+' : '-'}{formatCurrency(operation.amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Brak operacji dla tego konta</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Account Name Edit Dialog */}
        <AccountNameEditDialog
          account={accountToEdit}
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setAccountToEdit(null);
          }}
          onAccountUpdated={handleAccountUpdated}
        />
      </div>
    </MainLayout>
  );
};

export default AccountSearchPage;
