
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Edit, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface EditingAccount {
  id: string;
  number: string;
  name: string;
  type: string;
}

const AccountsManagement = () => {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<EditingAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('*')
        .order('number');
      
      if (searchQuery.trim()) {
        query = query.or(`number.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });

  // Update account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async ({ accountId, updatedAccount }: { accountId: string; updatedAccount: Partial<Account> }) => {
      const { error } = await supabase
        .from('accounts')
        .update(updatedAccount)
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingAccountId(null);
      setEditingAccount(null);
      toast({
        title: "Sukces",
        description: "Konto zostało zaktualizowane.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEditStart = (account: Account) => {
    setEditingAccountId(account.id);
    setEditingAccount({
      id: account.id,
      number: account.number,
      name: account.name,
      type: account.type,
    });
  };

  const handleEditCancel = () => {
    setEditingAccountId(null);
    setEditingAccount(null);
  };

  const handleEditSave = () => {
    if (!editingAccountId || !editingAccount) {
      return;
    }

    // Walidacja - sprawdź czy wszystkie pola są wypełnione
    if (!editingAccount.number.trim() || !editingAccount.name.trim() || !editingAccount.type.trim()) {
      toast({
        title: "Błąd",
        description: "Wszystkie pola muszą być wypełnione.",
        variant: "destructive",
      });
      return;
    }

    updateAccountMutation.mutate({
      accountId: editingAccountId,
      updatedAccount: {
        number: editingAccount.number.trim(),
        name: editingAccount.name.trim(),
        type: editingAccount.type.trim(),
      },
    });
  };

  const updateEditingAccount = (field: keyof EditingAccount, value: string) => {
    if (editingAccount) {
      setEditingAccount({
        ...editingAccount,
        [field]: value,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie kont...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Zarządzanie kontami</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Input
              placeholder="Wyszukaj konto po numerze lub nazwie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          {!accounts || accounts.length === 0 ? (
            <p className="text-center text-gray-500">
              {searchQuery ? 'Nie znaleziono kont pasujących do wyszukiwanego zapytania.' : 'Brak kont do wyświetlenia.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer konta</TableHead>
                    <TableHead>Nazwa konta</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {editingAccountId === account.id ? (
                          <Input
                            value={editingAccount?.number || ''}
                            onChange={(e) => updateEditingAccount('number', e.target.value)}
                            className="w-full"
                            placeholder="Numer konta"
                          />
                        ) : (
                          account.number
                        )}
                      </TableCell>
                      <TableCell>
                        {editingAccountId === account.id ? (
                          <Input
                            value={editingAccount?.name || ''}
                            onChange={(e) => updateEditingAccount('name', e.target.value)}
                            className="w-full"
                            placeholder="Nazwa konta"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleEditSave();
                              } else if (e.key === 'Escape') {
                                handleEditCancel();
                              }
                            }}
                          />
                        ) : (
                          account.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editingAccountId === account.id ? (
                          <Input
                            value={editingAccount?.type || ''}
                            onChange={(e) => updateEditingAccount('type', e.target.value)}
                            className="w-full"
                            placeholder="Typ konta"
                          />
                        ) : (
                          account.type
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingAccountId === account.id ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleEditSave}
                              disabled={updateAccountMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <Save className="h-3 w-3" />
                              Zapisz
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleEditCancel}
                              disabled={updateAccountMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <X className="h-3 w-3" />
                              Anuluj
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStart(account)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            Edytuj
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsManagement;
