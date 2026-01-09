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
 * Wykorzystuje funkcję SQL `get_user_filtered_accounts` do filtrowania server-side:
 * - Identyfikator lokalizacji (np. "1-3") to 2 liczby po pierwszym myślniku
 * - np. "100-1-3" = prefix "100", identifier "1-3"
 * - np. "100-1-3-5" = prefix "100", identifier "1-3", analityka "5"
 * 
 * Konta z zaznaczonymi restrykcjami są CAŁKOWICIE niewidoczne dla użytkowników danej kategorii placówki.
 */
export const useFilteredAccounts = (options?: UseFilteredAccountsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const skipRestrictions = options?.skipRestrictions ?? false;
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: ['filtered-accounts', user?.id, skipRestrictions, includeInactive],
    queryFn: async (): Promise<FilteredAccount[]> => {
      if (!user?.id) return [];

      // Wywołaj funkcję SQL do filtrowania server-side
      const { data, error } = await supabase.rpc('get_user_filtered_accounts', {
        p_user_id: user.id,
        p_include_inactive: includeInactive,
        p_skip_restrictions: skipRestrictions
      });

      if (error) {
        console.error('Error fetching filtered accounts:', error);
        throw error;
      }

      return (data || []) as FilteredAccount[];
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
