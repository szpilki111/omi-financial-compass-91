
import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Account } from '@/types/kpir';

interface AccountComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const AccountCombobox: React.FC<AccountComboboxProps> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayedAccountName, setDisplayedAccountName] = useState('');

  useEffect(() => {
    if (value) {
      const selectedInList = accounts.find(acc => acc.id === value);
      if (selectedInList) {
        setDisplayedAccountName(`${selectedInList.number} - ${selectedInList.name}`);
        return;
      }

      const fetchInitialAccount = async () => {
        const { data } = await supabase
          .from('accounts')
          .select('id, number, name')
          .eq('id', value)
          .single();
        if (data) {
          setDisplayedAccountName(`${data.number} - ${data.name}`);
        }
      };
      fetchInitialAccount();
    } else {
      setDisplayedAccountName('');
    }
  }, [value, accounts]);

  useEffect(() => {
    if (!open) {
        setAccounts([]);
        return;
    }
    if (searchTerm.length < 2) {
      setAccounts([]);
      return;
    }

    const fetchAccounts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .or(`number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .order('number', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
      } else {
        setAccounts(data || []);
      }
      setLoading(false);
    };

    const timer = setTimeout(() => {
      fetchAccounts();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, open]);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            setSearchTerm('');
        }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {displayedAccountName || "Wybierz konto..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Szukaj (nr lub nazwa, min. 2 znaki)..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {loading && <CommandEmpty>Szukanie...</CommandEmpty>}
            {searchTerm.length >= 2 && !loading && accounts.length === 0 && (
              <CommandEmpty>Nie znaleziono kont.</CommandEmpty>
            )}
            {searchTerm.length < 2 && !loading && (
               <CommandEmpty>Wpisz co najmniej 2 znaki, aby wyszukać.</CommandEmpty>
            )}
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue);
                    setOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === account.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {account.number} - {account.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
