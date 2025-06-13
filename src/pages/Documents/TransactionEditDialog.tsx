
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTransaction: any) => void;
  transaction: any;
  isNewDocument?: boolean;
  hiddenFields?: {
    debit?: boolean;
    credit?: boolean;
  };
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

const TransactionEditDialog = ({ 
  isOpen, 
  onClose, 
  onSave, 
  transaction, 
  isNewDocument = false,
  hiddenFields = {} 
}: TransactionEditDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
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

  // Load transaction data when dialog opens
  useEffect(() => {
    if (transaction && isOpen) {
      form.reset({
        description: transaction.description || '',
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        debit_amount: transaction.debit_amount || transaction.amount || 0,
        credit_amount: transaction.credit_amount || transaction.amount || 0,
      });

      // Load account names for the selected accounts
      loadAccountNames();
    }
  }, [transaction, isOpen, form]);

  const loadAccountNames = async () => {
    if (!transaction) return;

    try {
      // Load debit account
      if (transaction.debit_account_id) {
        const { data: debitAccount } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', transaction.debit_account_id)
          .single();
        
        if (debitAccount) {
          setDebitSearchQuery(`${debitAccount.number} - ${debitAccount.name}`);
        }
      }

      // Load credit account
      if (transaction.credit_account_id) {
        const { data: creditAccount } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', transaction.credit_account_id)
          .single();
        
        if (creditAccount) {
          setCreditSearchQuery(`${creditAccount.number} - ${creditAccount.name}`);
        }
      }
    } catch (error) {
      console.error('Error loading account names:', error);
    }
  };

  // Search accounts function (same as in TransactionForm)
  const searchAccounts = async (query: string, isDebit: boolean) => {
    if (!query || query.length < 2) {
      if (isDebit) {
        setDebitAccounts([]);
      } else {
        setCreditAccounts([]);
      }
      return;
    }

    if (!user?.location) {
      console.warn('Brak informacji o lokalizacji użytkownika');
      return;
    }

    try {
      if (isDebit) {
        setIsDebitSearching(true);
      } else {
        setIsCreditSearching(true);
      }
      
      // First get the location_account assignments for this location
      const { data: assignments, error: assignmentsError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', user.location);
        
      if (assignmentsError) {
        console.error('Błąd podczas pobierania przypisań kont:', assignmentsError);
        throw assignmentsError;
      }
      
      if (!assignments || assignments.length === 0) {
        if (isDebit) {
          setDebitAccounts([]);
        } else {
          setCreditAccounts([]);
        }
        return;
      }

      const accountIds = assignments.map(a => a.account_id);

      // Now get the actual accounts that match the search query
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .in('id', accountIds)
        .or(`number.ilike.%${query}%,name.ilike.%${query}%`)
        .order('number');
        
      if (accountsError) {
        console.error('Błąd podczas wyszukiwania kont:', accountsError);
        throw accountsError;
      }
      
      // Filter accounts based on debit/credit type
      let filteredData = accounts || [];
      
      if (isDebit) {
        // For debit accounts, exclude accounts in 700-799 range
        filteredData = filteredData.filter(account => {
          const accountNumber = parseInt(account.number);
          return !(accountNumber >= 700 && accountNumber <= 799);
        });
      } else {
        // For credit accounts, exclude accounts in 400-499 range
        filteredData = filteredData.filter(account => {
          const accountNumber = parseInt(account.number);
          return !(accountNumber >= 400 && accountNumber <= 499);
        });
      }
      
      if (isDebit) {
        setDebitAccounts(filteredData);
      } else {
        setCreditAccounts(filteredData);
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
  }, [debitSearchQuery, user?.location]);

  // Effect for credit account search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAccounts(creditSearchQuery, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [creditSearchQuery, user?.location]);

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

  const onSubmit = async (data: TransactionFormData) => {
    setIsLoading(true);
    try {
      // Create updated transaction object
      const updatedTransaction = {
        ...transaction,
        description: data.description,
        debit_account_id: data.debit_account_id,
        credit_account_id: data.credit_account_id,
        amount: Number(data.debit_amount),
        debit_amount: Number(data.debit_amount),
        credit_amount: Number(data.credit_amount),
      };

      // If this is a new document or transaction doesn't have ID, just update locally
      if (isNewDocument || !transaction?.id) {
        console.log('Updating transaction locally for new document');
        onSave(updatedTransaction);
        toast({
          title: "Sukces",
          description: "Transakcja została zaktualizowana",
        });
        onClose();
        return;
      }

      // If transaction has ID, update in database
      const { error } = await supabase
        .from('transactions')
        .update({
          description: data.description,
          debit_account_id: data.debit_account_id,
          credit_account_id: data.credit_account_id,
          amount: Number(data.debit_amount),
          debit_amount: Number(data.debit_amount),
          credit_amount: Number(data.credit_amount),
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Transakcja została zaktualizowana",
      });

      onSave(updatedTransaction);
      onClose();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować transakcji",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDebitAccount = debitAccounts.find(account => account.id === form.watch('debit_account_id'));
  const selectedCreditAccount = creditAccounts.find(account => account.id === form.watch('credit_account_id'));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj transakcję</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Hide description field for duplicated transactions */}
            {!hiddenFields.debit && !hiddenFields.credit && (
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show debit account only if not hidden */}
              {!hiddenFields.debit && (
                <FormField
                  control={form.control}
                  name="debit_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konto Winien</FormLabel>
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
                                <CommandEmpty>Nie znaleziono konta przypisanego do tej placówki.</CommandEmpty>
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
              )}

              {/* Show credit account only if not hidden */}
              {!hiddenFields.credit && (
                <FormField
                  control={form.control}
                  name="credit_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konto Ma</FormLabel>
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
                                <CommandEmpty>Nie znaleziono konta przypisanego do tej placówki.</CommandEmpty>
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
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show debit amount only if not hidden */}
              {!hiddenFields.debit && (
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
              )}

              {/* Show credit amount only if not hidden */}
              {!hiddenFields.credit && (
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
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionEditDialog;
