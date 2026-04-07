import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Percent, Save } from 'lucide-react';
import { AccountCombobox } from '@/pages/Documents/AccountCombobox';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const ProvincialFeeManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newAccountId, setNewAccountId] = useState('');

  // Fetch settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['provincialFeeSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch trigger accounts with account details
  const { data: triggerAccounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['provincialFeeAccounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_accounts')
        .select('id, account_id, accounts:account_id(id, number, name)');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all accounts for display
  const { data: allAccounts } = useQuery({
    queryKey: ['allAccountsForFee'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name')
        .eq('is_active', true)
        .order('number');
      if (error) throw error;
      return data;
    },
  });

  // Local form state
  const [feePercentage, setFeePercentage] = React.useState<string>('');
  const [targetDebitAccountId, setTargetDebitAccountId] = React.useState('');
  const [targetCreditAccountId, setTargetCreditAccountId] = React.useState('');

  // Sync from loaded settings
  React.useEffect(() => {
    if (settings) {
      setFeePercentage(String(settings.fee_percentage || 0));
      setTargetDebitAccountId(settings.target_debit_account_id || '');
      setTargetCreditAccountId(settings.target_credit_account_id || '');
    }
  }, [settings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const percentage = parseFloat(feePercentage) || 0;
      if (percentage < 0 || percentage > 100) {
        throw new Error('Procent musi być między 0 a 100');
      }

      const payload = {
        fee_percentage: percentage,
        target_debit_account_id: targetDebitAccountId || null,
        target_credit_account_id: targetCreditAccountId || null,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('provincial_fee_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('provincial_fee_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeSettings'] });
      toast({ title: 'Zapisano', description: 'Ustawienia opłaty prowincjalnej zostały zapisane' });
    },
    onError: (error: any) => {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    },
  });

  // Add trigger account
  const addAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('provincial_fee_accounts')
        .insert({ account_id: accountId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccounts'] });
      setNewAccountId('');
      toast({ title: 'Dodano', description: 'Konto wyzwalające zostało dodane' });
    },
    onError: (error: any) => {
      toast({
        title: 'Błąd',
        description: error.message?.includes('duplicate') ? 'To konto jest już na liście' : error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove trigger account
  const removeAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('provincial_fee_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccounts'] });
      toast({ title: 'Usunięto', description: 'Konto wyzwalające zostało usunięte' });
    },
    onError: (error: any) => {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    },
  });

  const getAccountLabel = (id: string) => {
    const acc = allAccounts?.find(a => a.id === id);
    return acc ? `${acc.number} - ${acc.name}` : id;
  };

  if (loadingSettings || loadingAccounts) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center gap-2">
          <Spinner />
          <span>Ładowanie ustawień...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Ustawienia opłaty prowincjalnej
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee-percentage">Procent opłaty (%)</Label>
              <Input
                id="fee-percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={feePercentage}
                onChange={(e) => setFeePercentage(e.target.value)}
                placeholder="np. 10"
              />
              <p className="text-xs text-muted-foreground">
                Kwota automatycznej operacji = kwota bazowa × {feePercentage || '0'}%
              </p>
            </div>

            <div className="space-y-2">
              <Label>Konto docelowe Winien (Wn)</Label>
              <AccountCombobox
                value={targetDebitAccountId}
                onChange={setTargetDebitAccountId}
                side="debit"
                skipRestrictions={true}
              />
              <p className="text-xs text-muted-foreground">
                Konto Wn w automatycznie tworzonej operacji
              </p>
            </div>

            <div className="space-y-2">
              <Label>Konto docelowe Ma</Label>
              <AccountCombobox
                value={targetCreditAccountId}
                onChange={setTargetCreditAccountId}
                side="credit"
                skipRestrictions={true}
              />
              <p className="text-xs text-muted-foreground">
                Konto Ma w automatycznie tworzonej operacji
              </p>
            </div>
          </div>

          <Button
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saveSettingsMutation.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia'}
          </Button>
        </CardContent>
      </Card>

      {/* Trigger Accounts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Konta wyzwalające opłatę prowincjalną</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gdy operacja zawiera jedno z poniższych kont (po stronie Wn lub Ma), system automatycznie
            utworzy dodatkową operację "procent na prowincję".
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new account */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Dodaj konto wyzwalające</Label>
              <AccountCombobox
                value={newAccountId}
                onChange={setNewAccountId}
                side="debit"
                skipRestrictions={true}
              />
            </div>
            <Button
              onClick={() => {
                if (newAccountId) addAccountMutation.mutate(newAccountId);
              }}
              disabled={!newAccountId || addAccountMutation.isPending}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>

          {/* List of trigger accounts */}
          {triggerAccounts && triggerAccounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer konta</TableHead>
                  <TableHead>Nazwa konta</TableHead>
                  <TableHead className="w-20">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggerAccounts.map((ta: any) => (
                  <TableRow key={ta.id}>
                    <TableCell>
                      <Badge variant="outline">{ta.accounts?.number || '—'}</Badge>
                    </TableCell>
                    <TableCell>{ta.accounts?.name || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAccountMutation.mutate(ta.id)}
                        disabled={removeAccountMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Brak zdefiniowanych kont wyzwalających. Dodaj konta powyżej.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProvincialFeeManagement;
