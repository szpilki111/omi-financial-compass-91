
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
    
    // Jeśli brak locationId, nie rób nic
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

      // Buduj query - jeśli jest searchTerm, filtruj po nim, jeśli nie, pokaż wszystkie
      let query = supabase
        .from('accounts')
        .select('id, number, name, type')
        .in('id', accountIds)
        .order('number', { ascending: true });

      // Jeśli jest searchTerm, dodaj filtrowanie
      if (searchTerm.trim()) {
        query = query.or(`number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
      }

      // Limit wyników
      query = query.limit(50);

      const { data, error } = await query;

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

    // Opóźnij zapytanie tylko gdy jest searchTerm
    if (searchTerm.trim()) {
      const timer = setTimeout(() => {
        fetchAccounts();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Jeśli nie ma searchTerm, ładuj od razu
      fetchAccounts();
    }
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
            placeholder="Szukaj (nr lub nazwa)..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {loading && <CommandEmpty>Ładowanie...</CommandEmpty>}
            {!locationId && !loading && <CommandEmpty>Lokalizacja nieokreślona.</CommandEmpty>}
            {locationId && !loading && accounts.length === 0 && !searchTerm.trim() && (
               <CommandEmpty>Brak dostępnych kont dla tej lokalizacji.</CommandEmpty>
            )}
            {locationId && !loading && accounts.length === 0 && searchTerm.trim() && (
              <CommandEmpty>Nie znaleziono kont pasujących do wyszukiwania.</CommandEmpty>
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
