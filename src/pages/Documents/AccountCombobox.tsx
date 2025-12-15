
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
  const [shouldAutoOpen, setShouldAutoOpen] = useState(true); // Track if we should auto-open

  useEffect(() => {
    if (value && locationId) {
      const selectedInList = accounts.find(acc => acc.id === value);
      if (selectedInList) {
        setDisplayedAccountName(selectedInList.number);
        return;
      }

      const fetchInitialAccount = async () => {
        // First try to fetch with location restriction if we have location_accounts
        const { data: locationAccountData } = await supabase
          .from('accounts')
          .select('id, number, name, location_accounts!inner(location_id)')
          .eq('id', value)
          .eq('location_accounts.location_id', locationId)
          .maybeSingle();

        if (locationAccountData) {
          setDisplayedAccountName(locationAccountData.number);
          return;
        }

        // If no location-specific account found, try to fetch the account directly
        // This handles cases where location_accounts table is empty (no restrictions)
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
      // If value exists but no locationId, try to fetch the account anyway
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
  }, [value, locationId]);

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
        // Don't clear accounts immediately to allow display name to persist
        return;
    }
    
    // Jeśli brak locationId, nie rób nic
    if (!locationId) {
      setAccounts([]);
      return;
    }

    const fetchAccounts = async () => {
      setLoading(true);

      // Get the location identifier first
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', locationId)
        .single();

      if (locationError) {
        console.error('Error fetching location data:', locationError);
        setAccounts([]);
        setLoading(false);
        return;
      }

      // Get location category from identifier
      const locationCategory = locationData?.location_identifier?.split('-')[0];
      console.log('Location category:', locationCategory);

      // Get account restrictions for this category
      let restrictions: any[] = [];
      if (locationCategory) {
        const { data: restrictionsData, error: restrictionsError } = await supabase
          .from('account_category_restrictions')
          .select('*')
          .eq('category_prefix', locationCategory)
          .eq('is_restricted', true);

        if (restrictionsError) {
          console.error('Error fetching restrictions:', restrictionsError);
        } else {
          restrictions = restrictionsData || [];
          console.log('Restrictions for category:', locationCategory, restrictions);
        }
      }

      // Get manually assigned accounts for this location
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

      let accountIds = locationAccountData.map(la => la.account_id);
      let allAccountsData: any[] = [];

      // Get manually assigned accounts
      if (accountIds.length > 0) {
        let query = supabase
          .from('accounts')
          .select('id, number, name, type')
          .in('id', accountIds)
          .order('number', { ascending: true });

        // Jeśli jest searchTerm, dodaj filtrowanie
        if (searchTerm.trim()) {
          query = query.or(`number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
        }

        const { data: manualAccounts, error } = await query;
        if (!error && manualAccounts) {
          allAccountsData = [...manualAccounts];
        }
      }

      // If location has an identifier, also include accounts that match the identifier pattern
      if (locationData?.location_identifier) {
        const identifier = locationData.location_identifier;
        
        // Get all accounts that end with the location identifier
        let autoQuery = supabase
          .from('accounts')
          .select('id, number, name, type')
          .order('number', { ascending: true });

        // Add search filtering if there's a search term
        if (searchTerm.trim()) {
          autoQuery = autoQuery.or(`number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
        }

        const { data: allAccounts, error: allAccountsError } = await autoQuery;

        if (!allAccountsError && allAccounts) {
          const matchingAccounts = allAccounts.filter(account => {
            // Check if account number starts with the location identifier after the first dash
            // Format: "functional_number-identifier" where identifier can be "X" or "X-Y"
            // Also match accounts with additional suffixes like "100-5-3-1" when identifier is "5-3"
            const accountParts = account.number.split('-');
            if (accountParts.length < 2) return false;
            
            // Get the suffix (everything after the first dash)
            const suffix = accountParts.slice(1).join('-');
            // Match exact identifier or identifier with additional parts
            return suffix === identifier || suffix.startsWith(identifier + '-');
          });

          // Merge with existing accounts, avoiding duplicates
          const existingAccountIds = new Set(allAccountsData.map(acc => acc.id));
          const newAccounts = matchingAccounts.filter(acc => !existingAccountIds.has(acc.id));
          allAccountsData = [...allAccountsData, ...newAccounts];
        }
      }

      // Apply category restrictions - remove accounts that are restricted for this category
      if (locationCategory && restrictions.length > 0) {
        const restrictedPrefixes = restrictions.map(r => r.account_number_prefix);
        console.log('Restricted prefixes for category:', locationCategory, restrictedPrefixes);
        
        allAccountsData = allAccountsData.filter(account => {
          // Extract account prefix (only first part before first hyphen)
          const parts = account.number.split('-');
          const accountPrefix = parts[0];
          const isRestricted = restrictedPrefixes.includes(accountPrefix);
          console.log(`Account ${account.number}, prefix: ${accountPrefix}, restricted: ${isRestricted}`);
          return !isRestricted;
        });
        
        console.log('Accounts after applying restrictions:', allAccountsData);
      }

      // Apply side filtering and sort
      let filteredAccounts = allAccountsData.filter(account => 
        isAccountAllowedForSide(account.number, side)
      );

      // Sort by account number
      filteredAccounts.sort((a, b) => a.number.localeCompare(b.number));

      // No limit - show all accounts (removed slice(0, 50))
      
      setAccounts(filteredAccounts);
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
            placeholder="Szukaj (nr lub nazwa)..."
            value={searchTerm}
            onValueChange={(value) => {
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
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Znajdź pierwsze pasujące konto
                const firstAccount = accounts[0];
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
          <CommandList className="max-h-[400px]">
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
