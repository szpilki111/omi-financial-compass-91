

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
  locationId?: string;
  className?: string;
  side?: 'debit' | 'credit';
  autoOpenOnFocus?: boolean;
  onAccountSelected?: () => void;
}

export const AccountCombobox: React.FC<AccountComboboxProps> = ({ 
  value, 
  onChange, 
  disabled, 
  locationId,
  className,
  side,
  autoOpenOnFocus = false,
  onAccountSelected
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayedAccountName, setDisplayedAccountName] = useState('');

  useEffect(() => {
    if (value && locationId) {
      const selectedInList = accounts.find(acc => acc.id === value);
      if (selectedInList) {
        setDisplayedAccountName(`${selectedInList.number} - ${selectedInList.name}`);
        return;
      }

      const fetchInitialAccount = async () => {
        // We use an inner join to ensure the account is valid for the location
        const { data } = await supabase
          .from('accounts')
          .select('id, number, name, location_accounts!inner(location_id)')
          .eq('id', value)
          .eq('location_accounts.location_id', locationId)
          .maybeSingle();

        if (data) {
          // KLUCZOWA POPRAWKA: Sprawdź czy konto jest dozwolone dla tej strony
          const isAccountAllowed = isAccountAllowedForSide(data.number, side);
          if (isAccountAllowed) {
            setDisplayedAccountName(`${data.number} - ${data.name}`);
          } else {
            // Konto nie jest dozwolone dla tej strony - wyczyść wybór
            setDisplayedAccountName('');
            onChange(''); // Wyczyść wybrane konto
          }
        } else {
          setDisplayedAccountName('');
        }
      };
      fetchInitialAccount();
    } else {
      setDisplayedAccountName('');
    }
  }, [value, accounts, locationId, side, onChange]);

  // Funkcja sprawdzająca czy konto jest dozwolone dla danej strony
  const isAccountAllowedForSide = (accountNumber: string, side?: 'debit' | 'credit') => {
    if (!side) return true;
    
    if (side === 'debit') {
      // Winien side: nie może mieć kont zaczynających się od "7"
      return !accountNumber.startsWith('7');
    } else if (side === 'credit') {
      // Ma side: nie może mieć kont zaczynających się od "4"
      return !accountNumber.startsWith('4');
    }
    
    return true;
  };

  useEffect(() => {
    if (!open) {
        setAccounts([]);
        return;
    }
    if (searchTerm.length < 2) {
      setAccounts([]);
      return;
    }
    if (!locationId) {
      setAccounts([]);
      return;
    }

    const fetchAccounts = async () => {
      setLoading(true);

      const { data: locationAccountData, error: locationAccountError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', locationId);
      
      if (locationAccountError) {
        console.error('Error fetching location accounts:', locationAccountError);
        setAccounts([]);
        setLoading(false);
        return;
      }

      const accountIds = locationAccountData.map(la => la.account_id);
      if (accountIds.length === 0) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .in('id', accountIds)
        .or(`number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .order('number', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
      } else {
        // KLUCZOWA POPRAWKA: Filtruj konta na podstawie restrykcji stron
        let filteredAccounts = data || [];
        
        filteredAccounts = filteredAccounts.filter(account => 
          isAccountAllowedForSide(account.number, side)
        );
        
        setAccounts(filteredAccounts);
      }
      setLoading(false);
    };

    const timer = setTimeout(() => {
      fetchAccounts();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, open, locationId, side]);

  // Funkcja obsługująca focus na przycisku
  const handleButtonFocus = () => {
    if (autoOpenOnFocus && !disabled && locationId) {
      setOpen(true);
    }
  };

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
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
          onFocus={handleButtonFocus}
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
            {!locationId && !loading && <CommandEmpty>Lokalizacja nieokreślona.</CommandEmpty>}
            {locationId && searchTerm.length < 2 && !loading && (
               <CommandEmpty>Wpisz co najmniej 2 znaki, aby wyszukać.</CommandEmpty>
            )}
            {locationId && searchTerm.length >= 2 && !loading && accounts.length === 0 && (
              <CommandEmpty>Nie znaleziono dozwolonych kont dla tej lokalizacji.</CommandEmpty>
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
                    // Wywołaj callback po wybraniu konta
                    if (onAccountSelected && currentValue !== value && currentValue !== '') {
                      setTimeout(() => {
                        onAccountSelected();
                      }, 100);
                    }
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
