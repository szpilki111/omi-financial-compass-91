
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionFormProps {
  onAdd: (transaction: any) => void;
  onCancel: () => void;
}

interface TransactionFormData {
  description: string;
  debit_account_id: string;
  credit_account_id: string;
  debit_amount: number;
  credit_amount: number;
}

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

const TransactionForm = ({ onAdd, onCancel }: TransactionFormProps) => {
  const [debitAccounts, setDebitAccounts] = useState<Account[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<Account[]>([]);
  const [debitSearchQuery, setDebitSearchQuery] = useState('');
  const [creditSearchQuery, setCreditSearchQuery] = useState('');
  const [isDebitSearching, setIsDebitSearching] = useState(false);
  const [isCreditSearching, setIsCreditSearching] = useState(false);
  const [debitSelectOpen, setDebitSelectOpen] = useState(false);
  const [creditSelectOpen, setCreditSelectOpen] = useState(false);

  const form = useForm<TransactionFormData>({
    defaultValues: {
      description: '',
      debit_account_id: '',
      credit_account_id: '',
      debit_amount: 0,
      credit_amount: 0,
    },
  });

  // Function to search accounts based on query
  const searchAccounts = async (query: string, isDebit: boolean) => {
    if (!query || query.length < 2) {
      if (isDebit) {
        setDebitAccounts([]);
      } else {
        setCreditAccounts([]);
      }
      return;
    }

    try {
      if (isDebit) {
        setIsDebitSearching(true);
      } else {
        setIsCreditSearching(true);
      }
      
      console.log('Wyszukiwanie kont dla zapytania:', query);
      
      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .or(`number.ilike.%${query}%,name.ilike.%${query}%`)
        .order('number', { ascending: true })
        .limit(50);
        
      if (error) {
        console.error('Błąd podczas wyszukiwania kont:', error);
        throw error;
      }
      
      console.log('Znalezione konta:', data);
      console.log('Liczba znalezionych kont:', data?.length || 0);
      
      if (isDebit) {
        setDebitAccounts(data || []);
      } else {
        setCreditAccounts(data || []);
      }
    } catch (error) {
      console.error('Błąd podczas wyszukiwania kont:', error);
    } finally {
      if (isDebit) {
        setIsDebitSearching(false);
      } else {
        setIsCreditSearching(false);
      }
    }
  };

  // Effect for debit account search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAccounts(debitSearchQuery, true);
    }, 300);

    return () => clearTimeout(timer);
  }, [debitSearchQuery]);

  // Effect for credit account search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAccounts(creditSearchQuery, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [creditSearchQuery]);

  const handleDebitAccountChange = (accountId: string) => {
    const selectedAccount = debitAccounts.find(acc => acc.id === accountId);
    
    form.setValue('debit_account_id', accountId);
    
    if (selectedAccount) {
      setDebitSearchQuery(`${selectedAccount.number} - ${selectedAccount.name}`);
    }
    
    setDebitSelectOpen(false);
  };

  const handleCreditAccountChange = (accountId: string) => {
    const selectedAccount = creditAccounts.find(acc => acc.id === accountId);
    
    form.setValue('credit_account_id', accountId);
    
    if (selectedAccount) {
      setCreditSearchQuery(`${selectedAccount.number} - ${selectedAccount.name}`);
    }
    
    setCreditSelectOpen(false);
  };

  const handleDebitSearchChange = (value: string) => {
    setDebitSearchQuery(value);
    
    // Clear selected account if user changes search text
    if (form.getValues('debit_account_id')) {
      const selectedAccount = debitAccounts.find(acc => acc.id === form.getValues('debit_account_id'));
      if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
        form.setValue('debit_account_id', '');
      }
    }
  };

  const handleCreditSearchChange = (value: string) => {
    setCreditSearchQuery(value);
    
    // Clear selected account if user changes search text
    if (form.getValues('credit_account_id')) {
      const selectedAccount = creditAccounts.find(acc => acc.id === form.getValues('credit_account_id'));
      if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
        form.setValue('credit_account_id', '');
      }
    }
  };

  const onSubmit = (data: TransactionFormData) => {
    onAdd({
      debit_account_id: data.debit_account_id,
      credit_account_id: data.credit_account_id,
      amount: Number(data.debit_amount), // Using debit amount as main amount for compatibility
      description: data.description,
      settlement_type: 'gotówka', // Default value for compatibility
      debit_amount: Number(data.debit_amount),
      credit_amount: Number(data.credit_amount),
    });
    form.reset();
    setDebitSearchQuery('');
    setCreditSearchQuery('');
    setDebitAccounts([]);
    setCreditAccounts([]);
  };

  const selectedDebitAccount = debitAccounts.find(account => account.id === form.watch('debit_account_id'));
  const selectedCreditAccount = creditAccounts.find(account => account.id === form.watch('credit_account_id'));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nowa transakcja</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opis transakcji</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Opis operacji księgowej" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="debit_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Konto Winien
                      {debitSearchQuery.length >= 2 && (
                        <span className="text-gray-500 ml-2">
                          ({isDebitSearching ? 'Wyszukiwanie...' : `${debitAccounts.length} znalezionych kont`})
                        </span>
                      )}
                    </FormLabel>
                    <Popover open={debitSelectOpen} onOpenChange={setDebitSelectOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={debitSelectOpen}
                            className="w-full justify-between"
                          >
                            {selectedDebitAccount ? 
                              `${selectedDebitAccount.number} - ${selectedDebitAccount.name}` : 
                              debitSearchQuery || "Wybierz konto winien..."
                            }
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-white border shadow-lg z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                        <Command>
                          <CommandInput 
                            placeholder="Wpisz numer lub nazwę konta..."
                            value={debitSearchQuery}
                            onValueChange={handleDebitSearchChange}
                          />
                          <CommandList className="max-h-60 overflow-y-auto">
                            {debitSearchQuery.length < 2 ? (
                              <div className="py-6 text-center text-sm text-gray-500">
                                Wpisz co najmniej 2 znaki, aby wyszukać konta...
                              </div>
                            ) : isDebitSearching ? (
                              <div className="py-6 text-center text-sm text-gray-500">
                                Wyszukiwanie...
                              </div>
                            ) : debitAccounts.length === 0 ? (
                              <CommandEmpty>Nie znaleziono konta.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {debitAccounts.map((account) => (
                                  <CommandItem
                                    key={account.id}
                                    value={`${account.number} ${account.name}`}
                                    onSelect={() => handleDebitAccountChange(account.id)}
                                    className="cursor-pointer hover:bg-gray-100"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedDebitAccount?.id === account.id ? "opacity-100" : "opacity-0"
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
                name="credit_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Konto Ma
                      {creditSearchQuery.length >= 2 && (
                        <span className="text-gray-500 ml-2">
                          ({isCreditSearching ? 'Wyszukiwanie...' : `${creditAccounts.length} znalezionych kont`})
                        </span>
                      )}
                    </FormLabel>
                    <Popover open={creditSelectOpen} onOpenChange={setCreditSelectOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={creditSelectOpen}
                            className="w-full justify-between"
                          >
                            {selectedCreditAccount ? 
                              `${selectedCreditAccount.number} - ${selectedCreditAccount.name}` : 
                              creditSearchQuery || "Wybierz konto ma..."
                            }
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-white border shadow-lg z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                        <Command>
                          <CommandInput 
                            placeholder="Wpisz numer lub nazwę konta..."
                            value={creditSearchQuery}
                            onValueChange={handleCreditSearchChange}
                          />
                          <CommandList className="max-h-60 overflow-y-auto">
                            {creditSearchQuery.length < 2 ? (
                              <div className="py-6 text-center text-sm text-gray-500">
                                Wpisz co najmniej 2 znaki, aby wyszukać konta...
                              </div>
                            ) : isCreditSearching ? (
                              <div className="py-6 text-center text-sm text-gray-500">
                                Wyszukiwanie...
                              </div>
                            ) : creditAccounts.length === 0 ? (
                              <CommandEmpty>Nie znaleziono konta.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {creditAccounts.map((account) => (
                                  <CommandItem
                                    key={account.id}
                                    value={`${account.number} ${account.name}`}
                                    onSelect={() => handleCreditAccountChange(account.id)}
                                    className="cursor-pointer hover:bg-gray-100"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedCreditAccount?.id === account.id ? "opacity-100" : "opacity-0"
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="debit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kwota Winien</FormLabel>
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
                name="credit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kwota Ma</FormLabel>
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
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Anuluj
              </Button>
              <Button type="submit">
                Dodaj transakcję
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TransactionForm;
