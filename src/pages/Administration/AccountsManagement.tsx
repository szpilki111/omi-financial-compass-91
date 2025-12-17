
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Edit, Save, X, Upload, Trash2, Plus, Archive, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
  is_active: boolean;
  deactivated_at?: string | null;
  deactivated_by?: string | null;
  deactivation_reason?: string | null;
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ number: '', name: '', type: 'Aktywny' });
  const [showInactive, setShowInactive] = useState(false);
  
  // Dialog states
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [hasRelatedTransactions, setHasRelatedTransactions] = useState(false);
  const [checkingTransactions, setCheckingTransactions] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query to prevent losing focus
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Check if user can manage accounts (admin/prowincjał)
  const canManageAccounts = useMemo(() => {
    return user?.role === 'admin' || user?.role === 'prowincjal';
  }, [user?.role]);

  // Check if user can import accounts (exclude prowincjał role)
  const canImportAccounts = useMemo(() => {
    return user?.role !== 'prowincjal';
  }, [user?.role]);

  // Fetch accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', debouncedSearchQuery, showInactive],
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('id, number, name, type, is_active, deactivated_at, deactivated_by, deactivation_reason')
        .order('number');
      
      // Filter by active status unless showing inactive
      if (!showInactive) {
        query = query.eq('is_active', true);
      }
      
      if (debouncedSearchQuery.trim()) {
        query = query.or(`number.ilike.%${debouncedSearchQuery}%,name.ilike.%${debouncedSearchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Account[];
    }
  });

  // Preserve focus after query updates
  useEffect(() => {
    if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
      if (searchQuery && !isImporting && !editingAccountId) {
        searchInputRef.current.focus();
      }
    }
  }, [accounts, searchQuery, isImporting, editingAccountId]);

  // Check if account has related transactions
  const checkRelatedTransactions = async (accountId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .or(`debit_account_id.eq.${accountId},credit_account_id.eq.${accountId}`)
      .limit(1);
    
    if (error) {
      console.error('Error checking transactions:', error);
      return true; // Assume there are transactions on error
    }
    
    return (count || 0) > 0;
  };

  // Add account mutation
  const addAccountMutation = useMutation({
    mutationFn: async (account: { number: string; name: string; type: string }) => {
      const { error } = await supabase
        .from('accounts')
        .insert([{ ...account, is_active: true }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsAdding(false);
      setNewAccount({ number: '', name: '', type: 'Aktywny' });
      toast({
        title: "Sukces",
        description: "Konto zostało dodane.",
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

  // Deactivate account mutation
  const deactivateAccountMutation = useMutation({
    mutationFn: async ({ accountId, reason }: { accountId: string; reason?: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: user?.id,
          deactivation_reason: reason || null,
        })
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDeactivateDialogOpen(false);
      setSelectedAccount(null);
      setDeactivationReason('');
      toast({
        title: "Sukces",
        description: "Konto zostało dezaktywowane.",
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

  // Reactivate account mutation
  const reactivateAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('accounts')
        .update({
          is_active: true,
          deactivated_at: null,
          deactivated_by: null,
          deactivation_reason: null,
        })
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: "Sukces",
        description: "Konto zostało reaktywowane.",
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

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDeleteDialogOpen(false);
      setSelectedAccount(null);
      toast({
        title: "Sukces",
        description: "Konto zostało trwale usunięte.",
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

  // Import accounts from CSV
  const importAccountsMutation = useMutation({
    mutationFn: async (accounts: { number: string; name: string }[]) => {
      const { data: existingAccounts, error: fetchError } = await supabase
        .from('accounts')
        .select('number');

      if (fetchError) throw fetchError;

      const existingNumbers = new Set(existingAccounts?.map(acc => acc.number) || []);

      const accountsToInsert = accounts
        .filter(account => !existingNumbers.has(account.number))
        .map(account => ({
          number: account.number,
          name: account.name,
          type: 'Aktywny',
          is_active: true
        }));

      if (accountsToInsert.length === 0) {
        throw new Error('Wszystkie konta z pliku już istnieją w systemie.');
      }

      const { error: insertError } = await supabase
        .from('accounts')
        .insert(accountsToInsert);

      if (insertError) throw insertError;

      return {
        imported: accountsToInsert.length,
        skipped: accounts.length - accountsToInsert.length
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsImporting(false);
      
      if (result.skipped > 0) {
        toast({
          title: "Import zakończony",
          description: `Zaimportowano ${result.imported} nowych kont. Pominięto ${result.skipped} kont, które już istnieją.`,
        });
      } else {
        toast({
          title: "Sukces",
          description: `Zaimportowano ${result.imported} nowych kont.`,
        });
      }
    },
    onError: (error: Error) => {
      setIsImporting(false);
      toast({
        title: "Błąd importu",
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
      type: account.type
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

  const updateEditingAccount = (field: keyof EditingAccount, value: string | boolean) => {
    if (editingAccount) {
      setEditingAccount({
        ...editingAccount,
        [field]: value,
      });
    }
  };

  const handleAddAccount = () => {
    if (!newAccount.number.trim() || !newAccount.name.trim() || !newAccount.type.trim()) {
      toast({
        title: "Błąd",
        description: "Wszystkie pola muszą być wypełnione.",
        variant: "destructive",
      });
      return;
    }

    addAccountMutation.mutate({
      number: newAccount.number.trim(),
      name: newAccount.name.trim(),
      type: newAccount.type.trim(),
    });
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewAccount({ number: '', name: '', type: 'Aktywny' });
  };

  const handleDeactivateClick = async (account: Account) => {
    setSelectedAccount(account);
    setCheckingTransactions(true);
    
    const hasTransactions = await checkRelatedTransactions(account.id);
    setHasRelatedTransactions(hasTransactions);
    setCheckingTransactions(false);
    setDeactivateDialogOpen(true);
  };

  const handleDeleteClick = async (account: Account) => {
    setSelectedAccount(account);
    setCheckingTransactions(true);
    
    const hasTransactions = await checkRelatedTransactions(account.id);
    setHasRelatedTransactions(hasTransactions);
    setCheckingTransactions(false);
    
    if (hasTransactions) {
      toast({
        title: "Nie można usunąć",
        description: "To konto ma powiązane operacje. Możesz je tylko dezaktywować.",
        variant: "destructive",
      });
      return;
    }
    
    setDeleteDialogOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const processFileContent = (content: string, encoding: string) => {
      console.log(`Próbuję odczytać plik w kodowaniu: ${encoding}`);
      
      const hasEncodingIssues = content.includes('�') || content.includes('Ã') || content.includes('Å');
      
      let processedContent = content;
      
      if (encoding === 'windows-1250' || hasEncodingIssues) {
        processedContent = content
          .replace(/¹/g, 'ą')
          .replace(/ê/g, 'ę') 
          .replace(/³/g, 'ł')
          .replace(/ñ/g, 'ń')
          .replace(/¿/g, 'ż')
          .replace(/¶/g, 'ś')
          .replace(/Ÿ/g, 'ź')
          .replace(/ó/g, 'ó')
          .replace(/Ä…/g, 'ą')
          .replace(/Ä™/g, 'ę')
          .replace(/Å‚/g, 'ł')
          .replace(/Å„/g, 'ń')
          .replace(/Å¼/g, 'ż')
          .replace(/Å›/g, 'ś')
          .replace(/Åº/g, 'ź')
          .replace(/Ã³/g, 'ó')
          .replace(/â€ž/g, '„')
          .replace(/â€œ/g, '"')
          .replace(/â€/g, '–');
      }
      
      const lines = processedContent.split(/\r?\n/).filter(line => line.trim());
      const accounts: { number: string; name: string }[] = [];
      const usedNumbers = new Set<string>();
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const match = trimmedLine.match(/^'([^']*?)','([^']*?)'$/);
        if (match) {
          const number = match[1].trim();
          const name = match[2].trim();
          
          if (number && name && !usedNumbers.has(number)) {
            accounts.push({ number, name });
            usedNumbers.add(number);
          }
        }
      }
      
      if (accounts.length === 0) {
        toast({
          title: "Błąd",
          description: "Nie znaleziono poprawnych kont w pliku. Sprawdź format: 'numer','nazwa'",
          variant: "destructive",
        });
        return false;
      }

      setIsImporting(true);
      importAccountsMutation.mutate(accounts);
      return true;
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        if (!content.includes('�') && !content.includes('Ã')) {
          if (processFileContent(content, 'UTF-8')) return;
        }
        
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e2) => {
          try {
            const fallbackContent = e2.target?.result as string;
            if (!processFileContent(fallbackContent, 'windows-1250')) {
              const iso88592Reader = new FileReader();
              iso88592Reader.onload = (e3) => {
                try {
                  const isoContent = e3.target?.result as string;
                  processFileContent(isoContent, 'ISO-8859-2');
                } catch (error) {
                  toast({
                    title: "Błąd",
                    description: "Nie udało się odczytać pliku w żadnym kodowaniu",
                    variant: "destructive",
                  });
                }
              };
              iso88592Reader.readAsText(file, 'ISO-8859-2');
            }
          } catch (error) {
            toast({
              title: "Błąd",
              description: "Nie udało się odczytać pliku",
              variant: "destructive",
            });
          }
        };
        fallbackReader.readAsText(file, 'windows-1250');
        
      } catch (error) {
        toast({
          title: "Błąd",
          description: "Nie udało się odczytać pliku",
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  // Count active and inactive accounts
  const activeCount = accounts?.filter(a => a.is_active).length || 0;
  const inactiveCount = accounts?.filter(a => !a.is_active).length || 0;

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
          <CardTitle className="flex items-center justify-between">
            <span>Zarządzanie kontami</span>
            <span className="text-sm font-normal text-muted-foreground">
              Aktywnych: {activeCount} {showInactive && `| Nieaktywnych: ${inactiveCount}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Input
                ref={searchInputRef}
                placeholder="Wyszukaj konto po numerze lub nazwie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
              
              {canManageAccounts && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-inactive"
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  />
                  <Label htmlFor="show-inactive" className="text-sm whitespace-nowrap">
                    Pokaż nieaktywne
                  </Label>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAdding(true)}
                disabled={isAdding}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Dodaj konto
              </Button>
              
              {canImportAccounts && (
                <>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                    disabled
                  />
                  <label htmlFor="csv-upload">
                    <Button
                      variant="outline"
                      disabled
                      className="cursor-not-allowed opacity-50"
                      asChild
                    >
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Importuj CSV
                      </span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </div>
          
          {isImporting && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Uwaga:</strong> Trwa zastępowanie wszystkich obecnych kont nowymi z pliku CSV...
              </p>
            </div>
          )}

          {!accounts || accounts.length === 0 ? (
            <p className="text-center text-gray-500">
              {debouncedSearchQuery ? 'Nie znaleziono kont pasujących do wyszukiwanego zapytania.' : 'Brak kont do wyświetlenia.'}
            </p>
          ) : (
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer konta</TableHead>
                    <TableHead>Nazwa konta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAdding && (
                    <TableRow className="bg-muted/50">
                      <TableCell>
                        <Input
                          value={newAccount.number}
                          onChange={(e) => setNewAccount({ ...newAccount, number: e.target.value })}
                          placeholder="Numer konta"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newAccount.name}
                          onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                          placeholder="Nazwa konta"
                          className="w-full"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddAccount();
                            } else if (e.key === 'Escape') {
                              handleCancelAdd();
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Aktywny</Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newAccount.type}
                          onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                          placeholder="Typ konta"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleAddAccount}
                            disabled={addAccountMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <Save className="h-3 w-3" />
                            Zapisz
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelAdd}
                            disabled={addAccountMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Anuluj
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {accounts.map((account) => (
                    <TableRow key={account.id} className={!account.is_active ? 'opacity-60' : ''}>
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
                          <div>
                            <span>{account.name}</span>
                            {!account.is_active && account.deactivation_reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Powód: {account.deactivation_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.is_active ? (
                          <Badge variant="default" className="bg-green-600">Aktywny</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-200 text-orange-800">Nieaktywny</Badge>
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
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStart(account)}
                              title="Edytuj"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {canManageAccounts && (
                              <>
                                {account.is_active ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeactivateClick(account)}
                                    disabled={deactivateAccountMutation.isPending}
                                    title="Dezaktywuj"
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => reactivateAccountMutation.mutate(account.id)}
                                    disabled={reactivateAccountMutation.isPending}
                                    title="Reaktywuj"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(account)}
                                  disabled={deleteAccountMutation.isPending || checkingTransactions}
                                  title="Usuń trwale"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </CardContent>
      </Card>

      {/* Deactivation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dezaktywuj konto</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz dezaktywować konto <strong>{selectedAccount?.number}</strong> ({selectedAccount?.name})?
            </DialogDescription>
          </DialogHeader>
          
          {hasRelatedTransactions && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                To konto ma powiązane operacje. Po dezaktywacji operacje historyczne pozostaną nienaruszone, 
                ale nie będzie można dodawać nowych operacji na tym koncie.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="reason">Powód dezaktywacji (opcjonalnie)</Label>
            <Textarea
              id="reason"
              value={deactivationReason}
              onChange={(e) => setDeactivationReason(e.target.value)}
              placeholder="Podaj powód dezaktywacji..."
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedAccount) {
                  deactivateAccountMutation.mutate({
                    accountId: selectedAccount.id,
                    reason: deactivationReason.trim() || undefined,
                  });
                }
              }}
              disabled={deactivateAccountMutation.isPending}
            >
              {deactivateAccountMutation.isPending ? 'Dezaktywowanie...' : 'Dezaktywuj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń konto trwale</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz trwale usunąć konto <strong>{selectedAccount?.number}</strong> ({selectedAccount?.name})?
              <br /><br />
              <strong className="text-destructive">Ta operacja jest nieodwracalna!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedAccount) {
                  deleteAccountMutation.mutate(selectedAccount.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccountMutation.isPending ? 'Usuwanie...' : 'Usuń trwale'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountsManagement;
