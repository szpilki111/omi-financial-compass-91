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
    queryKey: ['filtered-accounts', user?.location, skipRestrictions, includeInactive],
    queryFn: async (): Promise<FilteredAccount[]> => {
      if (!user?.location) return [];

      // Admin i prowincjał widzą wszystkie konta (chyba że skipRestrictions=false)
      if ((user.role === 'admin' || user.role === 'prowincjal') && skipRestrictions) {
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

      // 1. Pobierz dane lokalizacji (identyfikator)
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', user.location)
        .single();

      if (locationError) {
        console.error('Error fetching location data:', locationError);
        return [];
      }

      // 2. Pobierz kategorię lokalizacji z identyfikatora (pierwsza część przed myślnikiem)
      const locationCategory = locationData?.location_identifier?.split('-')[0];

      // 3. Pobierz restrykcje dla tej kategorii
      let restrictedPrefixes: string[] = [];
      if (locationCategory && !skipRestrictions) {
        const { data: restrictionsData, error: restrictionsError } = await supabase
          .from('account_category_restrictions')
          .select('account_number_prefix')
          .eq('category_prefix', locationCategory)
          .eq('is_restricted', true);

        if (!restrictionsError && restrictionsData) {
          restrictedPrefixes = restrictionsData.map(r => r.account_number_prefix);
        }
      }

      // 4. Pobierz ręcznie przypisane konta dla tej lokalizacji
      const { data: locationAccountData, error: locationAccountError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', user.location);

      if (locationAccountError) {
        console.error('Error fetching location accounts:', locationAccountError);
        return [];
      }

      const manualAccountIds = locationAccountData?.map(la => la.account_id) || [];
      let allAccountsData: FilteredAccount[] = [];

      // 5. Pobierz ręcznie przypisane konta
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

      // 6. Pobierz konta pasujące do identyfikatora lokalizacji
      if (locationData?.location_identifier) {
        const identifier = locationData.location_identifier;
        
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

      // 7. KLUCZOWE: Odfiltruj konta z ograniczeniami
      if (restrictedPrefixes.length > 0) {
        allAccountsData = allAccountsData.filter(account => {
          const parts = account.number.split('-');
          const accountPrefix = parts[0];
          // Jeśli prefix jest w ograniczonych - UKRYJ to konto
          return !restrictedPrefixes.includes(accountPrefix);
        });
      }

      // 8. Sortuj po numerze konta
      allAccountsData.sort((a, b) => a.number.localeCompare(b.number));

      return allAccountsData;
    },
    enabled: !!user?.location,
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
