
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionSplitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSplit: (splitTransactions: any[]) => void;
  transaction: any;
  splitSide: 'debit' | 'credit'; // Which side to split
}

interface SplitItem {
  account_id: string;
  amount: number;
  description: string;
}

interface SplitFormData {
  splitItems: SplitItem[];
}

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

const TransactionSplitDialog = ({ isOpen, onClose, onSplit, transaction, splitSide }: TransactionSplitDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const form = useForm<SplitFormData>({
    defaultValues: {
      splitItems: [{ account_id: '', amount: 0, description: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'splitItems',
  });

  const targetAmount = splitSide === 'debit' 
    ? (transaction.credit_amount || transaction.amount)
    : (transaction.debit_amount || transaction.amount);

  const fixedSide = splitSide === 'debit' ? 'credit' : 'debit';
  const fixedAccountId = splitSide === 'debit' 
    ? transaction.credit_account_id 
    : transaction.debit_account_id;

  // Search accounts function
  const searchAccounts = async (query: string) => {
    if (!query || query.length < 2) {
      setAccounts([]);
      return;
    }

    if (!user?.location) {
      console.warn('Brak informacji o lokalizacji użytkownika');
      return;
    }

    try {
      setIsSearching(true);
      
      // Get location account assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', user.location);
        
      if (assignmentsError) throw assignmentsError;
      
      if (!assignments || assignments.length === 0) {
        setAccounts([]);
        return;
      }

      const accountIds = assignments.map(a => a.account_id);

      // Get accounts that match the search query
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .in('id', accountIds)
        .or(`number.ilike.%${query}%,name.ilike.%${query}%`)
        .order('number');
        
      if (accountsError) throw accountsError;
      
      // Filter accounts based on split side
      let filteredData = accountsData || [];
      
      if (splitSide === 'debit') {
        // When splitting debit side, exclude accounts in 700-799 range (credit accounts)
        filteredData = filteredData.filter(account => {
          const accountNumber = parseInt(account.number);
          return !(accountNumber >= 700 && accountNumber <= 799);
        });
      } else {
        // When splitting credit side, exclude accounts in 400-499 range (debit accounts)
        filteredData = filteredData.filter(account => {
          const accountNumber = parseInt(account.number);
          return !(accountNumber >= 400 && accountNumber <= 499);
        });
      }
      
      setAccounts(filteredData);
    } catch (error) {
      console.error('Error searching accounts:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Update search queries array when fields change
  useEffect(() => {
    setSearchQueries(new Array(fields.length).fill(''));
  }, [fields.length]);

  const handleAccountChange = (index: number, accountId: string) => {
    const selectedAccount = accounts.find(acc => acc.id === accountId);
    form.setValue(`splitItems.${index}.account_id`, accountId);
    
    if (selectedAccount) {
      const newQueries = [...searchQueries];
      newQueries[index] = `${selectedAccount.number} - ${selectedAccount.name}`;
      setSearchQueries(newQueries);
    }
  };

  const handleSearchChange = (index: number, value: string) => {
    const newQueries = [...searchQueries];
    newQueries[index] = value;
    setSearchQueries(newQueries);
    
    // Clear selected account if user changes search text
    const currentAccountId = form.getValues(`splitItems.${index}.account_id`);
    if (currentAccountId) {
      const selectedAccount = accounts.find(acc => acc.id === currentAccountId);
      if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
        form.setValue(`splitItems.${index}.account_id`, '');
      }
    }
    
    searchAccounts(value);
  };

  const addSplitItem = () => {
    append({ account_id: '', amount: 0, description: '' });
  };

  const removeSplitItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      const newQueries = searchQueries.filter((_, i) => i !== index);
      setSearchQueries(newQueries);
    }
  };

  // Calculate total of split amounts
  const splitTotal = form.watch('splitItems').reduce((sum, item) => sum + (item.amount || 0), 0);
  const isBalanced = Math.abs(splitTotal - targetAmount) < 0.01;

  const onSubmit = (data: SplitFormData) => {
    if (!isBalanced) {
      toast({
        title: "Błąd",
        description: `Suma kwot rozbicia (${splitTotal.toFixed(2)} zł) musi być równa kwocie docelowej (${targetAmount.toFixed(2)} zł)`,
        variant: "destructive",
      });
      return;
    }

    // Create split transactions
    const splitTransactions = data.splitItems.map(item => {
      if (splitSide === 'debit') {
        return {
          debit_account_id: item.account_id,
          credit_account_id: fixedAccountId,
          amount: item.amount,
          debit_amount: item.amount,
          credit_amount: item.amount,
          description: item.description || transaction.description,
          settlement_type: transaction.settlement_type || 'gotówka',
        };
      } else {
        return {
          debit_account_id: fixedAccountId,
          credit_account_id: item.account_id,
          amount: item.amount,
          debit_amount: item.amount,
          credit_amount: item.amount,
          description: item.description || transaction.description,
          settlement_type: transaction.settlement_type || 'gotówka',
        };
      }
    });

    onSplit(splitTransactions);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Rozbicie transakcji - strona {splitSide === 'debit' ? 'Winien' : 'Ma'}
          </DialogTitle>
        </DialogHeader>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Informacje o transakcji</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p><strong>Opis:</strong> {transaction.description}</p>
            <p><strong>Strona {splitSide === 'debit' ? 'Ma' : 'Winien'} (stała):</strong> {targetAmount.toFixed(2)} zł</p>
            <p><strong>Do rozbicia (strona {splitSide === 'debit' ? 'Winien' : 'Ma'}):</strong> {targetAmount.toFixed(2)} zł</p>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`splitItems.${index}.account_id`}
                        render={() => (
                          <FormItem>
                            <FormLabel>Konto {splitSide === 'debit' ? 'Winien' : 'Ma'}</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between"
                                  >
                                    {searchQueries[index] || "Wybierz konto..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput 
                                    placeholder="Wpisz numer lub nazwę konta..."
                                    value={searchQueries[index] || ''}
                                    onValueChange={(value) => handleSearchChange(index, value)}
                                  />
                                  <CommandList className="max-h-60 overflow-y-auto">
                                    {(searchQueries[index]?.length || 0) < 2 ? (
                                      <div className="py-6 text-center text-sm text-gray-500">
                                        Wpisz co najmniej 2 znaki...
                                      </div>
                                    ) : isSearching ? (
                                      <div className="py-6 text-center text-sm text-gray-500">
                                        Wyszukiwanie...
                                      </div>
                                    ) : accounts.length === 0 ? (
                                      <CommandEmpty>Nie znaleziono konta.</CommandEmpty>
                                    ) : (
                                      <CommandGroup>
                                        {accounts.map((account) => (
                                          <CommandItem
                                            key={account.id}
                                            value={`${account.number} ${account.name}`}
                                            onSelect={() => handleAccountChange(index, account.id)}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                form.getValues(`splitItems.${index}.account_id`) === account.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {account.number} - {account.name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`splitItems.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kwota</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`splitItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Opis (opcjonalny)</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input {...field} placeholder="Dodatkowy opis..." />
                              </FormControl>
                              {fields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeSplitItem(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                onClick={addSplitItem}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Dodaj pozycję
              </Button>

              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Suma: {splitTotal.toFixed(2)} zł / Docelowo: {targetAmount.toFixed(2)} zł
                </p>
                {!isBalanced && (
                  <p className="text-sm text-red-600">
                    Różnica: {(splitTotal - targetAmount).toFixed(2)} zł
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={!isBalanced}>
                Rozbij transakcję
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionSplitDialog;
