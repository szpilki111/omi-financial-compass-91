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
 * UWAGA: Admin ZAWSZE widzi wszystkie konta bez żadnych filtrów i ograniczeń.
 * 
 * Wykorzystuje funkcję SQL `get_user_filtered_accounts` do filtrowania server-side:
 * - Identyfikator lokalizacji (np. "1-3") to 2 liczby po pierwszym myślniku
 * - np. "100-1-3" = prefix "100", identifier "1-3"
 * - np. "100-1-3-5" = prefix "100", identifier "1-3", analityka "5"
 * - Jednoczęściowy identyfikator (np. "1" dla Prowincji) też jest obsługiwany
 * 
 * Konta z zaznaczonymi restrykcjami są CAŁKOWICIE niewidoczne dla użytkowników danej kategorii placówki
 * (nie dotyczy admina).
 */
export const useFilteredAccounts = (options?: UseFilteredAccountsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Admin ZAWSZE widzi wszystkie konta bez ograniczeń
  const isAdmin = user?.role === 'admin';
  const skipRestrictions = isAdmin || (options?.skipRestrictions ?? false);
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: ['filtered-accounts', user?.id, skipRestrictions, includeInactive],
    queryFn: async (): Promise<FilteredAccount[]> => {
      if (!user?.id) return [];

      // Pobierz wszystkie konta bez limitu - Supabase ma domyślny limit 1000
      // Musimy paginować lub użyć .limit() z dużą wartością
      const allAccounts: FilteredAccount[] = [];
      const pageSize = 5000; // Pobierz po 5000 rekordów
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.rpc('get_user_filtered_accounts', {
          p_user_id: user.id,
          p_include_inactive: includeInactive,
          p_skip_restrictions: skipRestrictions
        }).range(offset, offset + pageSize - 1);

        if (error) {
          console.error('Error fetching filtered accounts:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allAccounts.push(...(data as FilteredAccount[]));
          offset += data.length;
          // Jeśli otrzymaliśmy mniej niż pageSize, to koniec
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allAccounts;
    },
    enabled: !!user?.id,
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
