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
      for (const identifier of userIdentifiers) {
        let query = supabase
          .from('accounts')
          .select('id, number, name, type, analytical')
          .or(`number.like.%-${identifier},number.like.%-${identifier}-%`)
          .order('number');
        
        if (!includeInactive) {
          query = query.eq('is_active', true);
        }

        const { data: matchingAccounts, error: matchError } = await query;

        if (!matchError && matchingAccounts) {
          // Merge bez duplikatów
          const existingAccountIds = new Set(allAccountsData.map(acc => acc.id));
          const newAccounts = matchingAccounts.filter(acc => !existingAccountIds.has(acc.id));
          allAccountsData = [...allAccountsData, ...newAccounts];
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
