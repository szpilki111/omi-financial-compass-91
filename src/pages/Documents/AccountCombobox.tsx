
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
import { useAuth } from '@/context/AuthContext';

// Limit wyświetlanych kont dla admina (performance optimization)
const ADMIN_DISPLAY_LIMIT = 20;

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
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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
  // For admin: search through ALL accounts but display only first 20
  // CRITICAL: Exclude accounts with has_analytics=true (parent accounts with sub-accounts)
  const filteredAccounts = useMemo(() => {
    let filtered = [...allAccounts];

    // CRITICAL: Filter out parent accounts that have sub-accounts (has_analytics=true)
    // These accounts should not be selectable for posting - user must select specific sub-account
    filtered = filtered.filter(account => !account.has_analytics);

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

    // For admin: limit displayed accounts to improve performance
    if (isAdmin) {
      return filtered.slice(0, ADMIN_DISPLAY_LIMIT);
    }

    return filtered;
  }, [allAccounts, searchTerm, side, isAdmin]);
  
  // Total matching count (for showing "more results" message)
  const totalMatchingCount = useMemo(() => {
    if (!isAdmin) return 0;
    
    let filtered = [...allAccounts];
    // Also exclude has_analytics accounts from count
    filtered = filtered.filter(account => !account.has_analytics);
    if (side) {
      filtered = filtered.filter(account => isAccountAllowedForSide(account.number, side));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(account => 
        account.number.toLowerCase().includes(term) || 
        account.name.toLowerCase().includes(term)
      );
    }
    return filtered.length;
  }, [allAccounts, searchTerm, side, isAdmin]);

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
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={false}
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
              // Jeśli użytkownik wpisał myślnik ręcznie, nie formatuj automatycznie
              // Pozwala to na wpisanie pełnych numerów kont jak "110-2-3"
              if (value.includes('-')) {
                setSearchTerm(value);
              } else {
                const startsWithDigit = /^\d/.test(value);
                
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
                // Pobierz aktualnie podświetlony element przez cmdk
                const selectedElement = document.querySelector('[cmdk-item][data-selected="true"]');
                if (selectedElement) {
                  const selectedId = selectedElement.getAttribute('data-value');
                  if (selectedId) {
                    e.preventDefault();
                    onChange(selectedId);
                    setOpen(false);
                    setSearchTerm('');
                    setShouldAutoOpen(false);
                    if (onAccountSelected) {
                      setTimeout(() => {
                        onAccountSelected();
                      }, 100);
                    }
                    return;
                  }
                }
                // Fallback: jeśli nie ma podświetlonego, wybierz pierwszy
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
              {filteredAccounts.map((account) => {
                const hasAnalytics = account.has_analytics ?? false;
                const isDisabled = hasAnalytics;
                
                return (
                  <CommandItem
                    key={account.id}
                    value={account.id}
                    disabled={isDisabled}
                    onSelect={(currentValue) => {
                      if (isDisabled) return; // Blokuj wybór kont z analityką
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
                    className={cn(
                      "flex items-center",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                    title={isDisabled ? "To konto ma podkonta analityczne - wybierz właściwe podkonto" : undefined}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === account.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-sm mr-2 shrink-0">{account.number}</span>
                    <span className="truncate flex-1" title={account.name}>{account.name}</span>
                    {hasAnalytics && (
                      <span className="text-muted-foreground ml-2 text-xs" title="Konto z analityką">📊</span>
                    )}
                  </CommandItem>
                );
              })}
              {/* Info for admin when more results are available */}
              {isAdmin && totalMatchingCount > ADMIN_DISPLAY_LIMIT && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center border-t">
                  Wyświetlono {ADMIN_DISPLAY_LIMIT} z {totalMatchingCount} kont. Wpisz więcej znaków aby zawęzić wyniki.
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
