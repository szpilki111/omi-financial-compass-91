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

  // Pobierz konta dostępne dla użytkownika
  const { data: availableAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['available-accounts', user?.location],
    queryFn: async () => {
      if (!user?.location) return [];

      let query = supabase
        .from('accounts')
        .select('*')
        .order('number');

      // Dla ekonomów - tylko konta przypisane do ich lokalizacji
      if (user.role === 'ekonom') {
        const { data: locationAccounts } = await supabase
          .from('location_accounts')
          .select('account_id')
          .eq('location_id', user.location);

        const accountIds = locationAccounts?.map(la => la.account_id) || [];
        if (accountIds.length === 0) return [];
        
        query = query.in('id', accountIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
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
      const { error } = await supabase
        .from('analytical_accounts')
        .delete()
        .eq('id', accountId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytical-accounts'] });
      toast.success('Konto analityczne zostało usunięte');
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

  const handleAddAnalytical = (account: Account) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    queryClient.invalidateQueries({ queryKey: ['analytical-accounts'] });
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
              const canExpand = account.analytical && (hasAnalytical || canManageAnalytical);

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
                      {account.analytical && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          Analityczne
                        </span>
                      )}
                    </div>

                    {account.analytical && canManageAnalytical && (
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