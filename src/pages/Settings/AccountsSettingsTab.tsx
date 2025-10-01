import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { AnalyticalAccountDialog } from '@/components/AnalyticalAccountDialog';
import { toast } from 'sonner';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
  analytical: boolean;
}

interface AnalyticalAccount {
  id: string;
  parent_account_id: string;
  number_suffix: string;
  name: string;
  location_id: string;
}

export const AccountsSettingsTab: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Pobierz restrykcje kont dla tej lokalizacji
  const { data: accountRestrictions } = useQuery({
    queryKey: ['account-restrictions', user?.location],
    queryFn: async () => {
      if (!user?.location) return [];

      // Get the location identifier first
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', user.location)
        .single();

      if (locationError) return [];

      // Get location category from identifier
      const locationCategory = locationData?.location_identifier?.split('-')[0];

      // Get ALL account restrictions, not just for this category
      // The restrictions define globally which accounts should be analytical
      const { data: restrictionsData, error: restrictionsError } = await supabase
        .from('account_category_restrictions')
        .select('*')
        .eq('analytical_required', true);

      if (restrictionsError) return [];
      return restrictionsData || [];
    },
    enabled: !!user?.location
  });

  // Pobierz konta dostępne dla użytkownika
  const { data: availableAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['available-accounts', user?.location],
    queryFn: async () => {
      if (!user?.location) return [];

      // For admin/prowincjal - show all accounts
      if (user.role === 'admin' || user.role === 'prowincjal') {
        const { data, error } = await supabase
          .from('accounts')
          .select('*')
          .order('number');
        if (error) throw error;
        return data || [];
      }

      // For ekonom - use same logic as AccountCombobox
      // Get the location identifier first
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', user.location)
        .single();

      if (locationError) {
        console.error('Error fetching location data:', locationError);
        return [];
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

        if (!restrictionsError) {
          restrictions = restrictionsData || [];
        }
      }

      // Get manually assigned accounts for this location
      const { data: locationAccountData, error: locationAccountError } = await supabase
        .from('location_accounts')
        .select('account_id')
        .eq('location_id', user.location);
      
      if (locationAccountError) {
        console.error('Error fetching location accounts:', locationAccountError);
        return [];
      }

      let accountIds = locationAccountData?.map(la => la.account_id) || [];
      let allAccountsData: any[] = [];

      // Get manually assigned accounts
      if (accountIds.length > 0) {
        const { data: manualAccounts, error } = await supabase
          .from('accounts')
          .select('*')
          .in('id', accountIds)
          .order('number');

        if (!error && manualAccounts) {
          allAccountsData = [...manualAccounts];
        }
      }

      // If location has an identifier, also include accounts that match the identifier pattern
      if (locationData?.location_identifier) {
        const identifier = locationData.location_identifier;
        
        // Get all accounts that end with the location identifier
        const { data: allAccounts, error: allAccountsError } = await supabase
          .from('accounts')
          .select('*')
          .order('number');

        if (!allAccountsError && allAccounts) {
          const matchingAccounts = allAccounts.filter(account => {
            // Check if account number starts with the location identifier after the first dash
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
        
        allAccountsData = allAccountsData.filter(account => {
          // Extract account prefix (only first part before first hyphen)
          const parts = account.number.split('-');
          const accountPrefix = parts[0];
          const isRestricted = restrictedPrefixes.includes(accountPrefix);
          return !isRestricted;
        });
      }

      // Sort by account number
      allAccountsData.sort((a, b) => a.number.localeCompare(b.number));

      return allAccountsData;
    },
    enabled: !!user?.location
  });

  // Pobierz konta analityczne
  const { data: analyticalAccounts, isLoading: analyticalLoading } = useQuery({
    queryKey: ['analytical-accounts', user?.location],
    queryFn: async () => {
      if (!user?.location) return [];

      const { data, error } = await supabase
        .from('analytical_accounts')
        .select('*')
        .eq('location_id', user.location)
        .order('number_suffix');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.location
  });

  // Mutacja do usuwania kont analitycznych
  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      // First get the analytical account details
      const { data: analyticalAccount, error: fetchError } = await supabase
        .from('analytical_accounts')
        .select('parent_account_id, number_suffix')
        .eq('id', accountId)
        .single();

      if (fetchError) {
        console.error('Error fetching analytical account:', fetchError);
        throw fetchError;
      }

      if (!analyticalAccount) {
        throw new Error('Analytical account not found');
      }

      // Get parent account number
      const { data: parentAccount, error: parentError } = await supabase
        .from('accounts')
        .select('number')
        .eq('id', analyticalAccount.parent_account_id)
        .single();

      if (parentError) {
        console.error('Error fetching parent account:', parentError);
        throw parentError;
      }

      if (!parentAccount) {
        throw new Error('Parent account not found');
      }

      const fullAccountNumber = `${parentAccount.number}-${analyticalAccount.number_suffix}`;
      
      console.log('Deleting analytical account with number:', fullAccountNumber);
      
      // Delete from accounts table first (the main account record)
      const { error: accountDeleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('number', fullAccountNumber);
      
      if (accountDeleteError) {
        console.error('Error deleting from accounts table:', accountDeleteError);
        throw accountDeleteError;
      }

      // Then delete from analytical_accounts table
      const { error: analyticalDeleteError } = await supabase
        .from('analytical_accounts')
        .delete()
        .eq('id', accountId);
      
      if (analyticalDeleteError) {
        console.error('Error deleting from analytical_accounts table:', analyticalDeleteError);
        throw analyticalDeleteError;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries with proper query keys
      queryClient.invalidateQueries({ queryKey: ['analytical-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['available-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Konto analityczne zostało trwale usunięte');
    },
    onError: (error) => {
      console.error('Error deleting analytical account:', error);
      toast.error('Błąd podczas usuwania konta analitycznego');
    }
  });

  const toggleExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const getNextSuffix = (parentAccountId: string): string => {
    const parentAnalytical = analyticalAccounts?.filter(
      aa => aa.parent_account_id === parentAccountId
    ) || [];
    
    if (parentAnalytical.length === 0) return '1';
    
    const existingSuffixes = parentAnalytical.map(aa => parseInt(aa.number_suffix));
    const maxSuffix = Math.max(...existingSuffixes);
    return (maxSuffix + 1).toString();
  };

  const getAccountAnalytical = (accountId: string): AnalyticalAccount[] => {
    return analyticalAccounts?.filter(aa => aa.parent_account_id === accountId) || [];
  };

  // Check if account should be analytical based on restrictions
  const isAccountAnalyticalRequired = (accountNumber: string): boolean => {
    if (!accountRestrictions) return false;
    
    // Extract account prefix (first part before first hyphen)
    const parts = accountNumber.split('-');
    const accountPrefix = parts[0];
    
    // Check if this prefix is marked as analytical_required
    return accountRestrictions.some(restriction => 
      restriction.account_number_prefix === accountPrefix && restriction.analytical_required
    );
  };

  const handleAddAnalytical = (account: Account) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    queryClient.invalidateQueries({ queryKey: ['analytical-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['available-accounts'] });
  };

  const handleDeleteAnalytical = (analyticalAccountId: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć to konto analityczne?')) {
      deleteMutation.mutate(analyticalAccountId);
    }
  };

  const canManageAnalytical = user?.role === 'ekonom' || user?.role === 'proboszcz';

  if (accountsLoading || analyticalLoading) {
    return <Spinner />;
  }

  if (!availableAccounts?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dostępne konta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Brak dostępnych kont dla tej lokalizacji.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dostępne konta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {availableAccounts.map((account) => {
              const isExpanded = expandedAccounts.has(account.id);
              const accountAnalytical = getAccountAnalytical(account.id);
              const hasAnalytical = accountAnalytical.length > 0;
              const isAnalyticalRequired = isAccountAnalyticalRequired(account.number);
              const canExpand = isAnalyticalRequired && (hasAnalytical || canManageAnalytical);

              return (
                <div key={account.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => canExpand && toggleExpanded(account.id)}
                    >
                      {canExpand && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                      <span className="font-medium">{account.number}</span>
                      <span className="text-muted-foreground">-</span>
                      <span>{account.name}</span>
                      {isAnalyticalRequired && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          Analityczne
                        </span>
                      )}
                    </div>

                    {isAnalyticalRequired && canManageAnalytical && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAnalytical(account)}
                        className="ml-2"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Dodaj podkonto
                      </Button>
                    )}
                  </div>

                  {isExpanded && hasAnalytical && (
                    <div className="mt-3 ml-8 space-y-2">
                      {accountAnalytical.map((analytical) => (
                        <div key={analytical.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {account.number}-{analytical.number_suffix}
                            </span>
                            <span className="text-muted-foreground">-</span>
                            <span>{analytical.name}</span>
                          </div>
                          
                          {canManageAnalytical && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteAnalytical(analytical.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              Usuń
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <AnalyticalAccountDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleDialogSave}
          parentAccount={selectedAccount}
          nextSuffix={getNextSuffix(selectedAccount.id)}
        />
      )}
    </div>
  );
};