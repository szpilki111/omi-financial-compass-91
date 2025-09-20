
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
import { Edit, Save, X, Upload, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
  analytical: boolean;
}

interface EditingAccount {
  id: string;
  number: string;
  name: string;
  type: string;
  analytical: boolean;
}

const AccountsManagement = () => {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<EditingAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
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

  // Check if user can import accounts (exclude prowincjał role)
  const canImportAccounts = useMemo(() => {
    return user?.role !== 'prowincjal';
  }, [user?.role]);

  // Fetch accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', debouncedSearchQuery],
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('*')
        .order('number');
      
      if (debouncedSearchQuery.trim()) {
        query = query.or(`number.ilike.%${debouncedSearchQuery}%,name.ilike.%${debouncedSearchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });

  // Preserve focus after query updates
  useEffect(() => {
    if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
      // Only refocus if the user was typing (searchQuery is not empty)
      if (searchQuery && !isImporting && !editingAccountId) {
        searchInputRef.current.focus();
      }
    }
  }, [accounts, searchQuery, isImporting, editingAccountId]);

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

  // Import accounts from CSV
  const importAccountsMutation = useMutation({
    mutationFn: async (accounts: { number: string; name: string }[]) => {
      // Najpierw usuń wszystkie obecne konta
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition to delete all)

      if (deleteError) throw deleteError;

      // Następnie dodaj nowe konta
      const accountsToInsert = accounts.map(account => ({
        number: account.number,
        name: account.name,
        type: 'Aktywny' // Domyślny typ
      }));

      const { error: insertError } = await supabase
        .from('accounts')
        .insert(accountsToInsert);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsImporting(false);
      toast({
        title: "Sukces",
        description: "Konta zostały pomyślnie zaimportowane.",
      });
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
      type: account.type,
      analytical: account.analytical
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

  const updateEditingAccount = (field: keyof EditingAccount, value: string | boolean) => {
    if (editingAccount) {
      setEditingAccount({
        ...editingAccount,
        [field]: value,
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const processFileContent = (content: string, encoding: string) => {
      console.log(`Próbuję odczytać plik w kodowaniu: ${encoding}`);
      console.log('Pierwsze 200 znaków:', content.substring(0, 200));
      
      // Sprawdź czy są problemy z kodowaniem
      const hasEncodingIssues = content.includes('�') || content.includes('Ã') || content.includes('Å');
      console.log('Problemy z kodowaniem:', hasEncodingIssues);
      
      let processedContent = content;
      
      // Jeśli to Windows-1250, napraw polskie znaki
      if (encoding === 'windows-1250' || hasEncodingIssues) {
        processedContent = content
          // Mapowanie z Windows-1250/ISO-8859-2
          .replace(/¹/g, 'ą')
          .replace(/ê/g, 'ę') 
          .replace(/³/g, 'ł')
          .replace(/ñ/g, 'ń')
          .replace(/¿/g, 'ż')
          .replace(/¶/g, 'ś')
          .replace(/Ÿ/g, 'ź')
          .replace(/ó/g, 'ó')
          // Mapowanie z UTF-8 błędnie interpretowanego jako Windows-1250
          .replace(/Ä…/g, 'ą')
          .replace(/Ä™/g, 'ę')
          .replace(/Å‚/g, 'ł')
          .replace(/Å„/g, 'ń')
          .replace(/Å¼/g, 'ż')
          .replace(/Å›/g, 'ś')
          .replace(/Åº/g, 'ź')
          .replace(/Ã³/g, 'ó')
          // Dodatkowe mapowania
          .replace(/â€ž/g, '„')
          .replace(/â€œ/g, '"')
          .replace(/â€/g, '–');
        
        console.log('Po naprawie znaków:', processedContent.substring(0, 200));
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
          
          console.log(`Parsed: ${number} -> ${name}`);
          
          if (number && name && !usedNumbers.has(number)) {
            accounts.push({ number, name });
            usedNumbers.add(number);
          }
        } else {
          console.log('Nie można sparsować linii:', trimmedLine);
        }
      }
      
      console.log(`Znaleziono ${accounts.length} kont`);
      
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

    // Pierwsza próba: UTF-8
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        // Sprawdź czy UTF-8 dało dobre rezultaty
        if (!content.includes('�') && !content.includes('Ã')) {
          if (processFileContent(content, 'UTF-8')) return;
        }
        
        // Jeśli UTF-8 nie zadziałało, spróbuj Windows-1250
        console.log('UTF-8 nie zadziałało, próbuję Windows-1250...');
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e2) => {
          try {
            const fallbackContent = e2.target?.result as string;
            if (!processFileContent(fallbackContent, 'windows-1250')) {
              // Ostatnia próba: ISO-8859-2
              console.log('Windows-1250 nie zadziałało, próbuję ISO-8859-2...');
              const iso88592Reader = new FileReader();
              iso88592Reader.onload = (e3) => {
                try {
                  const isoContent = e3.target?.result as string;
                  processFileContent(isoContent, 'ISO-8859-2');
                } catch (error) {
                  console.error('Błąd ISO-8859-2:', error);
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
            console.error('Błąd Windows-1250:', error);
            toast({
              title: "Błąd",
              description: "Nie udało się odczytać pliku",
              variant: "destructive",
            });
          }
        };
        fallbackReader.readAsText(file, 'windows-1250');
        
      } catch (error) {
        console.error('Błąd UTF-8:', error);
        toast({
          title: "Błąd",
          description: "Nie udało się odczytać pliku",
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(file, 'UTF-8');
    event.target.value = ''; // Reset input
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
          <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between">
            <Input
              ref={searchInputRef}
              placeholder="Wyszukaj konto po numerze lub nazwie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            
            {canImportAccounts && (
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={isImporting}
                />
                <label htmlFor="csv-upload">
                  <Button
                    variant="outline"
                    disabled={isImporting}
                    className="cursor-pointer"
                    asChild
                  >
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {isImporting ? 'Importowanie...' : 'Importuj CSV'}
                    </span>
                  </Button>
                </label>
              </div>
            )}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer konta</TableHead>
                    <TableHead>Nazwa konta</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Analityczne</TableHead>
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
                      <TableCell>
                        {editingAccountId === account.id ? (
                          <Switch
                            checked={editingAccount?.analytical || false}
                            onCheckedChange={(checked) => updateEditingAccount('analytical', checked)}
                          />
                        ) : (
                          <Switch
                            checked={account.analytical}
                            onCheckedChange={(checked) => {
                              // Update analytical status immediately
                              updateAccountMutation.mutate({
                                accountId: account.id,
                                updatedAccount: { analytical: checked }
                              });
                            }}
                            disabled={updateAccountMutation.isPending}
                          />
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
