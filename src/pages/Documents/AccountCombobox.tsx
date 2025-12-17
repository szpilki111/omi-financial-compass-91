
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
  const [allAccounts, setAllAccounts] = useState<Account[]>([]); // All accounts for location
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]); // Filtered by search
  const [loading, setLoading] = useState(false);
  const [displayedAccountName, setDisplayedAccountName] = useState('');
  const [shouldAutoOpen, setShouldAutoOpen] = useState(true); // Track if we should auto-open
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Load all accounts for location once on mount or when locationId changes
  useEffect(() => {
    if (!locationId) {
      setAllAccounts([]);
      setInitialLoadDone(true);
      return;
    }

    const fetchAllAccounts = async () => {
      setLoading(true);

      // Get the location identifier first
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', locationId)
        .single();

      if (locationError) {
        console.error('Error fetching location data:', locationError);
        setAllAccounts([]);
        setLoading(false);
        setInitialLoadDone(true);
        return;
      }

      // Get location category from identifier
      const locationCategory = locationData?.location_identifier?.split('-')[0];

      // Get account restrictions for this category
      let restrictions: any[] = [];
      if (locationCategory) {
        const { data: restrictionsData, error: restrictionsError } = await supabase
          .from('account_category_restrictions')
          .select('*')
          .eq('category_prefix', locationCategory)
          .eq('is_restricted', true);

        if (!restrictionsError && restrictionsData) {
          restrictions = restrictionsData;
        }
      }

      // Get manually assigned accounts for this location
      const { data: locationAccountData, error: locationAccountError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', locationId);
      
      if (locationAccountError) {
        console.error('Error fetching location accounts:', locationAccountError);
        setAllAccounts([]);
        setLoading(false);
        setInitialLoadDone(true);
        return;
      }

      let accountIds = locationAccountData.map(la => la.account_id);
      let allAccountsData: any[] = [];

      // Get manually assigned accounts (only active ones)
      if (accountIds.length > 0) {
        const { data: manualAccounts, error } = await supabase
          .from('accounts')
          .select('id, number, name, type')
          .in('id', accountIds)
          .eq('is_active', true)
          .order('number', { ascending: true });

        if (!error && manualAccounts) {
          allAccountsData = [...manualAccounts];
        }
      }

      // If location has an identifier, fetch accounts matching the pattern using server-side filtering
      if (locationData?.location_identifier) {
        const identifier = locationData.location_identifier;
        
        // Use server-side LIKE filtering for better performance (only active accounts)
        const { data: matchingAccounts, error: matchError } = await supabase
          .from('accounts')
          .select('id, number, name, type')
          .eq('is_active', true)
          .or(`number.like.%-${identifier},number.like.%-${identifier}-%`)
          .order('number', { ascending: true });

        if (!matchError && matchingAccounts) {
          // Merge with existing accounts, avoiding duplicates
          const existingAccountIds = new Set(allAccountsData.map(acc => acc.id));
          const newAccounts = matchingAccounts.filter(acc => !existingAccountIds.has(acc.id));
          allAccountsData = [...allAccountsData, ...newAccounts];
        }
      }

      // Apply category restrictions - remove accounts that are restricted for this category
      if (locationCategory && restrictions.length > 0) {
        const restrictedPrefixes = restrictions.map(r => r.account_number_prefix);
        
        allAccountsData = allAccountsData.filter(account => {
          const parts = account.number.split('-');
          const accountPrefix = parts[0];
          return !restrictedPrefixes.includes(accountPrefix);
        });
      }

      // Sort by account number
      allAccountsData.sort((a, b) => a.number.localeCompare(b.number));
      
      setAllAccounts(allAccountsData);
      setLoading(false);
      setInitialLoadDone(true);
    };

    fetchAllAccounts();
  }, [locationId]);

  // Funkcja sprawdzająca czy konto jest dozwolone dla danej strony
  const isAccountAllowedForSide = (accountNumber: string, checkSide?: 'debit' | 'credit') => {
    if (!checkSide) return true;
    
    if (checkSide === 'debit') {
      // Winien side: nie może mieć kont zaczynających się od "7"
      return !accountNumber.startsWith('7');
    } else if (checkSide === 'credit') {
      // Ma side: nie może mieć kont zaczynających się od "4"
      return !accountNumber.startsWith('4');
    }
    
    return true;
  };

  // Filter accounts by search term and side (client-side filtering)
  useEffect(() => {
    let filtered = [...allAccounts];

    // Apply side filtering
    if (side) {
      filtered = filtered.filter(account => isAccountAllowedForSide(account.number, side));
    }

    // Apply search term filtering
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(account => 
        account.number.toLowerCase().includes(term) || 
        account.name.toLowerCase().includes(term)
      );
    }

    setFilteredAccounts(filtered);
  }, [allAccounts, searchTerm, side]);

  // Fetch display name for selected account
  useEffect(() => {
    if (value && locationId) {
      const selectedInList = allAccounts.find(acc => acc.id === value);
      if (selectedInList) {
        setDisplayedAccountName(selectedInList.number);
        return;
      }

      const fetchInitialAccount = async () => {
        const { data: accountData } = await supabase
          .from('accounts')
          .select('id, number, name')
          .eq('id', value)
          .maybeSingle();

        if (accountData) {
          setDisplayedAccountName(accountData.number);
        } else {
          setDisplayedAccountName('');
        }
      };
      fetchInitialAccount();
    } else if (value) {
      const fetchAccount = async () => {
        const { data } = await supabase
          .from('accounts')
          .select('id, number, name')
          .eq('id', value)
          .maybeSingle();

        if (data) {
          setDisplayedAccountName(data.number);
        } else {
          setDisplayedAccountName('');
        }
      };
      fetchAccount();
    } else {
      setDisplayedAccountName('');
    }
  }, [value, locationId, allAccounts]);

  // Funkcja obsługująca focus na przycisku
  const handleButtonFocus = () => {
    if (autoOpenOnFocus && !disabled && locationId && shouldAutoOpen) {
      setOpen(true);
    }
  };
  
  // Reset shouldAutoOpen when value changes from empty to filled
  useEffect(() => {
    if (value) {
      setShouldAutoOpen(false);
    } else {
      setShouldAutoOpen(true);
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            setSearchTerm('');
        }
    }}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
          onFocus={handleButtonFocus}
        >
          <span className="truncate">
            {displayedAccountName || "Wybierz"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[450px] w-auto max-w-[600px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Szukaj po numerze lub nazwie..."
            value={searchTerm}
            onValueChange={(value) => {
              // Sprawdź czy użytkownik wpisuje cyfry czy tekst
              const startsWithDigit = /^\d/.test(value.replace(/-/g, ''));
              
              if (startsWithDigit) {
                // Automatyczne formatowanie: dodaj myślnik po każdych 3 cyfrach
                const digitsOnly = value.replace(/\D/g, '');
                let formatted = '';
                for (let i = 0; i < digitsOnly.length; i++) {
                  if (i > 0 && i % 3 === 0) {
                    formatted += '-';
                  }
                  formatted += digitsOnly[i];
                }
                setSearchTerm(formatted);
              } else {
                // Dla tekstu - przepuść bez zmian (wyszukiwanie po nazwie)
                setSearchTerm(value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                // Zamknij popover i przenieś fokus na trigger, który pozwoli na naturalną nawigację Tab
                e.preventDefault();
                setOpen(false);
                setSearchTerm('');
                
                // Po zamknięciu popovera, przenieś fokus na następny element
                setTimeout(() => {
                  if (triggerRef.current) {
                    // Znajdź wszystkie focusowalne elementy
                    const focusableElements = document.querySelectorAll<HTMLElement>(
                      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    );
                    const elements = Array.from(focusableElements);
                    const currentIndex = elements.indexOf(triggerRef.current);
                    
                    // Przejdź do następnego (lub poprzedniego jeśli Shift+Tab)
                    const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
                    if (nextIndex >= 0 && nextIndex < elements.length) {
                      elements[nextIndex].focus();
                    }
                  }
                }, 0);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                // Znajdź pierwsze pasujące konto
                const firstAccount = filteredAccounts[0];
                if (firstAccount) {
                  onChange(firstAccount.id);
                  setOpen(false);
                  setSearchTerm('');
                  setShouldAutoOpen(false); // Prevent auto-open after Enter selection
                  // Wywołaj callback po wybraniu konta
                  if (onAccountSelected) {
                    setTimeout(() => {
                      onAccountSelected();
                    }, 100);
                  }
                }
              }
            }}
          />
          <CommandList className="max-h-[400px] overflow-y-auto">
            {loading && <CommandEmpty>Ładowanie...</CommandEmpty>}
            {!locationId && !loading && <CommandEmpty>Lokalizacja nieokreślona.</CommandEmpty>}
            {locationId && !loading && filteredAccounts.length === 0 && !searchTerm.trim() && (
               <CommandEmpty>Brak dostępnych kont dla tej lokalizacji.</CommandEmpty>
            )}
            {locationId && !loading && filteredAccounts.length === 0 && searchTerm.trim() && (
              <CommandEmpty>Nie znaleziono kont pasujących do wyszukiwania.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredAccounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue);
                    setOpen(false);
                    setSearchTerm('');
                    setShouldAutoOpen(false); // Prevent auto-open after selection
                    // Wywołaj callback po wybraniu konta
                    if (onAccountSelected && currentValue !== value && currentValue !== '') {
                      setTimeout(() => {
                        onAccountSelected();
                      }, 100);
                    }
                  }}
                  className="flex items-center"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === account.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-sm mr-2 shrink-0">{account.number}</span>
                  <span className="truncate flex-1" title={account.name}>{account.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
