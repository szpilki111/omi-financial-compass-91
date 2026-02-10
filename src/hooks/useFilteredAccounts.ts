import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface FilteredAccount {
  id: string;
  number: string;
  name: string;
  type: string;
  analytical?: boolean;
  has_analytics?: boolean;
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
 * Wykorzystuje funkcję SQL `get_user_filtered_accounts_with_analytics` do filtrowania server-side:
 * - Identyfikator lokalizacji (np. "1-3") to 2 liczby po pierwszym myślniku
 * - np. "100-1-3" = prefix "100", identifier "1-3"
 * - np. "100-1-3-5" = prefix "100", identifier "1-3", analityka "5"
 * - Jednoczęściowy identyfikator (np. "1" dla Prowincji) też jest obsługiwany
 *
 * Konta z zaznaczonymi restrykcjami są CAŁKOWICIE niewidoczne dla użytkowników danej kategorii placówki
 * (nie dotyczy admina).
 *
 * Konta z has_analytics=true mają podkonta analityczne i nie powinny być bezpośrednio wybierane do operacji.
 */
export const useFilteredAccounts = (options?: UseFilteredAccountsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Admin ZAWSZE widzi wszystkie konta bez ograniczeń
  const isAdmin = user?.role === "admin";
  const skipRestrictions = isAdmin || (options?.skipRestrictions ?? false);
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: ["filtered-accounts", user?.id, skipRestrictions, includeInactive],
    queryFn: async (): Promise<FilteredAccount[]> => {
      if (!user?.id) return [];

      // OPTYMALIZACJA: Dla admina użyj bezpośredniego zapytania (jak w Administracji)
      // Jest znacznie szybsze niż RPC z paginacją (~0.5s vs ~30s dla 6000+ kont)
      if (isAdmin) {
        console.log("[useFilteredAccounts] Admin detected - using fast direct query");
        
        const allAccounts: FilteredAccount[] = [];
        const pageSize = 1000; // Limit Supabase per request
        let offset = 0;
        let hasMore = true;
        let iterations = 0;
        const maxIterations = 20; // Bezpiecznik

        while (hasMore && iterations < maxIterations) {
          iterations++;
          
          let query = supabase
            .from('accounts')
            .select('id, number, name, type, is_active, analytical')
            .order('number')
            .range(offset, offset + pageSize - 1);
          
          if (!includeInactive) {
            query = query.eq('is_active', true);
          }
          
          const { data, error } = await query;
          
          if (error) {
            console.error("Error fetching accounts for admin:", error);
            throw error;
          }
          
          const fetchedCount = data?.length ?? 0;
          console.log(`[useFilteredAccounts] Admin page ${iterations}: fetched ${fetchedCount} accounts`);
          
          if (data && fetchedCount > 0) {
            allAccounts.push(...(data as FilteredAccount[]));
            offset += fetchedCount;
            hasMore = fetchedCount === pageSize;
          } else {
            hasMore = false;
          }
        }

        console.log(`[useFilteredAccounts] Admin total: ${allAccounts.length} accounts in ${iterations} pages`);

        // Oblicz has_analytics client-side
        const processedAccounts = allAccounts.map((acc) => {
          const hasSubAccounts = allAccounts.some((sub) => sub.number.startsWith(acc.number + "-"));
          return {
            ...acc,
            has_analytics: hasSubAccounts,
          };
        });

        return processedAccounts;
      }

      // Dla innych ról - użyj RPC z paginacją
      const allAccounts: FilteredAccount[] = [];
      const pageSize = 1000; // Limit Supabase per request - KRYTYCZNE: nie zmieniać na mniejszą wartość!
      let offset = 0;
      let hasMore = true;
      let iterations = 0;
      const maxIterations = 50; // Bezpiecznik - max 50000 kont

      console.log("[useFilteredAccounts] Starting pagination fetch via RPC...");

      while (hasMore && iterations < maxIterations) {
        iterations++;

        // Używamy nowej funkcji z flagą has_analytics
        const { data, error } = await supabase
          .rpc("get_user_filtered_accounts_with_analytics", {
            p_user_id: user.id,
            p_include_inactive: includeInactive,
            p_skip_restrictions: skipRestrictions,
          })
          .range(offset, offset + pageSize - 1);

        if (error) {
          console.error("Error fetching filtered accounts:", error);
          throw error;
        }

        const fetchedCount = data?.length ?? 0;
        console.log(`[useFilteredAccounts] Page ${iterations}: fetched ${fetchedCount} accounts (offset: ${offset})`);

        if (data && fetchedCount > 0) {
          allAccounts.push(...(data as FilteredAccount[]));
          offset += fetchedCount;
          // Kontynuuj jeśli otrzymaliśmy pełną stronę (pageSize rekordów)
          hasMore = fetchedCount === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`[useFilteredAccounts] Total fetched: ${allAccounts.length} accounts in ${iterations} pages`);

      // Dynamicznie oblicz has_analytics dla WSZYSTKICH poziomów zagłębienia
      // Konto ma has_analytics=true jeśli istnieje jakiekolwiek inne konto zaczynające się od "number-"
      const processedAccounts = allAccounts.map((acc) => {
        // Sprawdź czy istnieje jakiekolwiek konto zaczynające się od tego numeru + "-"
        const hasSubAccounts = allAccounts.some((sub) => sub.number.startsWith(acc.number + "-"));
        return {
          ...acc,
          has_analytics: hasSubAccounts,
        };
      });

      return processedAccounts;
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
    queryClient.invalidateQueries({ queryKey: ["filtered-accounts"] });
  };
};
