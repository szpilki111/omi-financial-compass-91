
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
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';

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
  const [displayedAccountName, setDisplayedAccountName] = useState('');
  const [shouldAutoOpen, setShouldAutoOpen] = useState(true);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Use central hook for fetching accounts with restrictions applied
  const { data: allAccounts = [], isLoading: loading } = useFilteredAccounts();

  // Filter accounts by side (debit/credit) restrictions
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
  const filteredAccounts = useMemo(() => {
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

    return filtered;
  }, [allAccounts, searchTerm, side]);

  // Fetch display name for selected account
  useEffect(() => {
    if (value) {
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
    } else {
      setDisplayedAccountName('');
    }
  }, [value, allAccounts]);

  // Handle focus on button
  const handleButtonFocus = () => {
    if (autoOpenOnFocus && !disabled && shouldAutoOpen) {
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
      <PopoverContent 
        className="min-w-[450px] w-auto max-w-[600px] p-0"
        onWheel={(e) => {
          const list = e.currentTarget.querySelector('[cmdk-list]') as HTMLElement;
          if (list) {
            e.stopPropagation();
            list.scrollTop += e.deltaY;
          }
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Szukaj po numerze lub nazwie..."
            value={searchTerm}
            onValueChange={(value) => {
              const startsWithDigit = /^\d/.test(value.replace(/-/g, ''));
              
              if (startsWithDigit) {
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
                setSearchTerm(value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                setOpen(false);
                setSearchTerm('');
                
                setTimeout(() => {
                  if (triggerRef.current) {
                    const focusableElements = document.querySelectorAll<HTMLElement>(
                      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    );
                    const elements = Array.from(focusableElements);
                    const currentIndex = elements.indexOf(triggerRef.current);
                    
                    const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
                    if (nextIndex >= 0 && nextIndex < elements.length) {
                      elements[nextIndex].focus();
                    }
                  }
                }, 0);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const firstAccount = filteredAccounts[0];
                if (firstAccount) {
                  onChange(firstAccount.id);
                  setOpen(false);
                  setSearchTerm('');
                  setShouldAutoOpen(false);
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
            {!loading && filteredAccounts.length === 0 && !searchTerm.trim() && (
               <CommandEmpty>Brak dostępnych kont dla tej lokalizacji.</CommandEmpty>
            )}
            {!loading && filteredAccounts.length === 0 && searchTerm.trim() && (
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
                    setShouldAutoOpen(false);
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
