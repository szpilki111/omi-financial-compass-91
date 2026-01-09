import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';
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

const TransactionSplitDialog = ({ isOpen, onClose, onSplit, transaction, splitSide }: TransactionSplitDialogProps) => {
  // Add null check for transaction BEFORE any hooks
  if (!transaction) {
    return null;
  }

  const { toast } = useToast();
  const { data: allAccounts = [] } = useFilteredAccounts();
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<FilteredAccount[]>([]);

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
    ? (transaction.credit_amount || transaction.amount || 0)
    : (transaction.debit_amount || transaction.amount || 0);

  const fixedSide = splitSide === 'debit' ? 'credit' : 'debit';
  const fixedAccountId = splitSide === 'debit' 
    ? transaction.credit_account_id 
    : transaction.debit_account_id;

  // Filter accounts based on search query using the pre-fetched filtered accounts
  const searchAccounts = useMemo(() => (query: string) => {
    if (!query || query.length < 2) {
      setFilteredAccounts([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    let filtered = allAccounts.filter(account =>
      account.number.toLowerCase().includes(lowerQuery) ||
      account.name.toLowerCase().includes(lowerQuery)
    );

    // Filter accounts based on split side
    if (splitSide === 'debit') {
      // When splitting debit side, exclude accounts in 700-799 range (credit accounts)
      filtered = filtered.filter(account => {
        const accountNumber = parseInt(account.number.split('-')[0]);
        return !(accountNumber >= 700 && accountNumber <= 799);
      });
    } else {
      // When splitting credit side, exclude accounts in 400-499 range (debit accounts)
      filtered = filtered.filter(account => {
        const accountNumber = parseInt(account.number.split('-')[0]);
        return !(accountNumber >= 400 && accountNumber <= 499);
      });
    }
    
    setFilteredAccounts(filtered);
  }, [allAccounts, splitSide]);

  // Update search queries array when fields change
  useEffect(() => {
    setSearchQueries(new Array(fields.length).fill(''));
  }, [fields.length]);

  const handleAccountChange = (index: number, accountId: string) => {
    const selectedAccount = allAccounts.find(acc => acc.id === accountId);
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
      const selectedAccount = allAccounts.find(acc => acc.id === currentAccountId);
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

    // Zapewnij, że każda subtransakcja ma opis (z transakcji głównej jeśli user nie podał)
    const splitTransactions = data.splitItems.map(item => {
      let description = (typeof item.description === "string" && item.description.trim() !== "")
        ? item.description
        : (transaction.description || "");

      if (splitSide === 'debit') {
        return {
          debit_account_id: item.account_id,
          credit_account_id: fixedAccountId,
          amount: item.amount,
          debit_amount: item.amount,
          credit_amount: item.amount,
          description,
          settlement_type: transaction.settlement_type || 'gotówka',
        };
      } else {
        return {
          debit_account_id: fixedAccountId,
          credit_account_id: item.account_id,
          amount: item.amount,
          debit_amount: item.amount,
          credit_amount: item.amount,
          description,
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
            Rozbicie operacji - strona {splitSide === 'debit' ? 'Winien' : 'Ma'}
          </DialogTitle>
        </DialogHeader>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Informacje o operacji</CardTitle>
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
                                    ) : filteredAccounts.length === 0 ? (
                                      <CommandEmpty>Nie znaleziono konta.</CommandEmpty>
                                    ) : (
                                      <CommandGroup>
                                        {filteredAccounts.map((account) => (
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
                                type="text"
                                inputMode="decimal"
                                value={field.value || ''}
                                onChange={(e) => {
                                  const normalizedValue = e.target.value.replace(",", ".");
                                  field.onChange(Number(normalizedValue) || 0);
                                }}
                                onKeyDown={(e) => {
                                  // Allow: digits, dot, comma, minus, backspace, delete, tab, arrows
                                  if (
                                    !/[\d.,\-]/.test(e.key) &&
                                    !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) &&
                                    !e.ctrlKey && !e.metaKey
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
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
                Rozbij operację
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionSplitDialog;
