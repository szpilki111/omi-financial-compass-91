
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

const AccountsManagement = () => {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');
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

  // Update account name mutation
  const updateAccountMutation = useMutation({
    mutationFn: async ({ accountId, newName }: { accountId: string; newName: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update({ name: newName.trim() })
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingAccountId(null);
      setEditedName('');
      toast({
        title: "Sukces",
        description: "Nazwa konta została zaktualizowana.",
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
    setEditedName(account.name);
  };

  const handleEditCancel = () => {
    setEditingAccountId(null);
    setEditedName('');
  };

  const handleEditSave = () => {
    if (!editingAccountId || !editedName.trim()) {
      toast({
        title: "Błąd",
        description: "Nazwa konta nie może być pusta.",
        variant: "destructive",
      });
      return;
    }

    updateAccountMutation.mutate({
      accountId: editingAccountId,
      newName: editedName.trim(),
    });
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
                        {account.number}
                      </TableCell>
                      <TableCell>
                        {editingAccountId === account.id ? (
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="w-full"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleEditSave();
                              } else if (e.key === 'Escape') {
                                handleEditCancel();
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          account.name
                        )}
                      </TableCell>
                      <TableCell>{account.type}</TableCell>
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
