import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface FilteredAccount {
  id: string;
  number: string;
  name: string;
  type: string;
  analytical?: boolean;
}

interface UseFilteredAccountsOptions {
  includeInactive?: boolean;
  skipRestrictions?: boolean; // For admin pages that need to see all accounts
}

/**
 * Centralny hook do pobierania kont z uwzględnieniem restrykcji widoczności.
 * 
 * Ten hook automatycznie:
 * 1. Pobiera kategorię lokalizacji użytkownika
 * 2. Pobiera restrykcje kont dla tej kategorii
 * 3. Filtruje konta zgodnie z restrykcjami
 * 
 * Konta z zaznaczonymi restrykcjami są CAŁKOWICIE niewidoczne dla użytkowników danej kategorii placówki.
 */
export const useFilteredAccounts = (options?: UseFilteredAccountsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const skipRestrictions = options?.skipRestrictions ?? false;
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: ['filtered-accounts', user?.locations, skipRestrictions, includeInactive],
    queryFn: async (): Promise<FilteredAccount[]> => {
      // Użyj wszystkich lokalizacji użytkownika
      const userLocations = user?.locations || [];
      const userIdentifiers = user?.locationIdentifiers || [];
      
      if (userLocations.length === 0) return [];

      // Admin i prowincjał widzą wszystkie konta (chyba że skipRestrictions=false)
      if ((user?.role === 'admin' || user?.role === 'prowincjal') && skipRestrictions) {
        const { data, error } = await supabase
          .from('accounts')
          .select('id, number, name, type, analytical')
          .order('number');
        
        if (error) throw error;
        
        if (!includeInactive) {
          return (data || []).filter((acc: any) => acc.is_active !== false);
        }
        return data || [];
      }

      // 1. Pobierz kategorie lokalizacji z identyfikatorów (pierwsza część przed myślnikiem)
      const locationCategories = [...new Set(
        userIdentifiers.map(id => id.split('-')[0]).filter(Boolean)
      )];

      // 2. Pobierz restrykcje dla wszystkich kategorii
      let restrictedPrefixes: string[] = [];
      if (locationCategories.length > 0 && !skipRestrictions) {
        const { data: restrictionsData, error: restrictionsError } = await supabase
          .from('account_category_restrictions')
          .select('account_number_prefix')
          .in('category_prefix', locationCategories)
          .eq('is_restricted', true);

        if (!restrictionsError && restrictionsData) {
          restrictedPrefixes = [...new Set(restrictionsData.map(r => r.account_number_prefix))];
        }
      }

      // 3. Pobierz ręcznie przypisane konta dla WSZYSTKICH lokalizacji użytkownika
      const { data: locationAccountData, error: locationAccountError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .in('location_id', userLocations);

      if (locationAccountError) {
        console.error('Error fetching location accounts:', locationAccountError);
        return [];
      }

      const manualAccountIds = [...new Set(locationAccountData?.map(la => la.account_id) || [])];
      let allAccountsData: FilteredAccount[] = [];

      // 4. Pobierz ręcznie przypisane konta
      if (manualAccountIds.length > 0) {
        let query = supabase
          .from('accounts')
          .select('id, number, name, type, analytical')
          .in('id', manualAccountIds)
          .order('number');
        
        if (!includeInactive) {
          query = query.eq('is_active', true);
        }

        const { data: manualAccounts, error } = await query;

        if (!error && manualAccounts) {
          allAccountsData = [...manualAccounts];
        }
      }

      // 5. Pobierz konta pasujące do WSZYSTKICH identyfikatorów lokalizacji
      // WAŻNE: Identyfikator lokalizacji (np. "1-3") składa się z 2 liczb oddzielonych myślnikiem
      // i występuje ZARAZ PO pierwszym myślniku w numerze konta
      // np. "100-1-3" = prefix "100", identifier "1-3"
      // np. "100-1-3-5" = prefix "100", identifier "1-3", analityka "5"
      // NIE: "100-2-1-3" - to jest identifier "2-1", analityka "3"
      
      // Funkcja do sprawdzenia czy konto należy do danej lokalizacji
      const accountMatchesIdentifier = (accountNumber: string, identifier: string): boolean => {
        const parts = accountNumber.split('-');
        if (parts.length < 2) return false;
        
        // Identyfikator to 2 liczby po pierwszym myślniku, np. "1-3"
        const identifierParts = identifier.split('-');
        if (identifierParts.length !== 2) return false;
        
        // Sprawdź czy części 1 i 2 numeru konta pasują do identyfikatora
        // parts[0] = prefix (np. "100")
        // parts[1] = pierwsza część identyfikatora (np. "1")
        // parts[2] = druga część identyfikatora (np. "3")
        if (parts.length >= 3) {
          return parts[1] === identifierParts[0] && parts[2] === identifierParts[1];
        } else if (parts.length === 2) {
          // Dla kont typu "100-1" - nie pasuje do identyfikatora "1-3"
          return false;
        }
        
        return false;
      };
      
      // Pobierz wszystkie konta i filtruj po stronie klienta
      let query = supabase
        .from('accounts')
        .select('id, number, name, type, analytical')
        .order('number');
      
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data: allAccounts, error: fetchError } = await query;

      if (!fetchError && allAccounts) {
        for (const account of allAccounts) {
          // Sprawdź czy konto pasuje do któregokolwiek identyfikatora użytkownika
          const matchesAnyIdentifier = userIdentifiers.some(identifier => 
            accountMatchesIdentifier(account.number, identifier)
          );
          
          if (matchesAnyIdentifier) {
            const existingAccountIds = new Set(allAccountsData.map(acc => acc.id));
            if (!existingAccountIds.has(account.id)) {
              allAccountsData.push(account);
            }
          }
        }
      }

      // 6. KLUCZOWE: Odfiltruj konta z ograniczeniami
      if (restrictedPrefixes.length > 0) {
        allAccountsData = allAccountsData.filter(account => {
          const parts = account.number.split('-');
          const accountPrefix = parts[0];
          // Jeśli prefix jest w ograniczonych - UKRYJ to konto
          return !restrictedPrefixes.includes(accountPrefix);
        });
      }

      // 7. Sortuj po numerze konta
      allAccountsData.sort((a, b) => a.number.localeCompare(b.number));

      return allAccountsData;
    },
    enabled: (user?.locations?.length ?? 0) > 0,
    staleTime: 5 * 60 * 1000, // 5 minut cache
  });
};

/**
 * Helper do invalidacji cache kont po zmianie restrykcji
 */
export const useInvalidateFilteredAccounts = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['filtered-accounts'] });
  };
};
