import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Percent, Save, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountPrefixSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const AccountPrefixSelector: React.FC<AccountPrefixSelectorProps> = ({ value, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all accounts to extract unique prefixes
  const { data: accounts } = useQuery({
    queryKey: ['allAccountsForPrefixes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('number, name')
        .eq('is_active', true)
        .order('number');
      if (error) throw error;
      return data;
    },
  });

  // Extract unique base prefixes (first segment before dash)
  const uniquePrefixes = useMemo(() => {
    if (!accounts) return [];
    const prefixMap = new Map<string, string>();
    for (const acc of accounts) {
      const prefix = acc.number.split('-')[0];
      if (!prefixMap.has(prefix)) {
        prefixMap.set(prefix, acc.name);
      }
    }
    return Array.from(prefixMap.entries())
      .map(([prefix, name]) => ({ prefix, name }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix));
  }, [accounts]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return uniquePrefixes;
    const term = searchTerm.toLowerCase();
    return uniquePrefixes.filter(
      (p) => p.prefix.includes(term) || p.name.toLowerCase().includes(term)
    );
  }, [uniquePrefixes, searchTerm]);

  const selectedLabel = uniquePrefixes.find((p) => p.prefix === value);

  return (
    <Popover open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setSearchTerm(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value ? `${value} - ${selectedLabel?.name || ''}` : 'Wybierz prefix konta'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[400px] p-0"
        side="top"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Szukaj po numerze lub nazwie..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            {filtered.length === 0 && <CommandEmpty>Nie znaleziono kont.</CommandEmpty>}
            <CommandGroup>
              {filtered.map((item) => (
                <CommandItem
                  key={item.prefix}
                  value={item.prefix}
                  onSelect={() => {
                    onChange(item.prefix === value ? '' : item.prefix);
                    setOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === item.prefix ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-mono text-sm mr-2">{item.prefix}</span>
                  <span className="truncate">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ProvincialFeeManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPrefix, setNewPrefix] = useState('');

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

  // Fetch trigger account prefixes
  const { data: triggerPrefixes, isLoading: loadingAccounts } = useQuery({
    queryKey: ['provincialFeeAccounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_accounts')
        .select('id, account_number_prefix');
      if (error) throw error;
      return data;
    },
  });

  // Local form state
  const [feePercentage, setFeePercentage] = React.useState<string>('');
  const [targetDebitPrefix, setTargetDebitPrefix] = React.useState('');
  const [targetCreditPrefix, setTargetCreditPrefix] = React.useState('');

  // Sync from loaded settings
  React.useEffect(() => {
    if (settings) {
      setFeePercentage(String(settings.fee_percentage || 0));
      setTargetDebitPrefix((settings as any).target_debit_account_prefix || '');
      setTargetCreditPrefix((settings as any).target_credit_account_prefix || '');
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
        target_debit_account_prefix: targetDebitPrefix || null,
        target_credit_account_prefix: targetCreditPrefix || null,
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

  // Add trigger prefix
  const addPrefixMutation = useMutation({
    mutationFn: async (prefix: string) => {
      const { error } = await supabase
        .from('provincial_fee_accounts')
        .insert({ account_number_prefix: prefix });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccounts'] });
      setNewPrefix('');
      toast({ title: 'Dodano', description: 'Prefix konta wyzwalającego został dodany' });
    },
    onError: (error: any) => {
      toast({
        title: 'Błąd',
        description: error.message?.includes('duplicate') ? 'Ten prefix jest już na liście' : error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove trigger prefix
  const removePrefixMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('provincial_fee_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccounts'] });
      toast({ title: 'Usunięto', description: 'Prefix konta wyzwalającego został usunięty' });
    },
    onError: (error: any) => {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    },
  });

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
              <Label>Konto docelowe Winien (Wn) — prefix</Label>
              <AccountPrefixSelector
                value={targetDebitPrefix}
                onChange={setTargetDebitPrefix}
              />
              <p className="text-xs text-muted-foreground">
                Ogólny numer konta (np. 400). Identyfikator placówki będzie dodany automatycznie.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Konto docelowe Ma — prefix</Label>
              <AccountPrefixSelector
                value={targetCreditPrefix}
                onChange={setTargetCreditPrefix}
              />
              <p className="text-xs text-muted-foreground">
                Ogólny numer konta (np. 700). Identyfikator placówki będzie dodany automatycznie.
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
            Gdy operacja zawiera konto zaczynające się od jednego z poniższych prefiksów (po stronie Wn lub Ma), 
            system automatycznie utworzy dodatkową operację "procent na prowincję". 
            Podaj ogólny numer konta (np. 400) — identyfikator placówki nie jest potrzebny.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new prefix */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Dodaj prefix konta wyzwalającego</Label>
              <AccountPrefixSelector
                value={newPrefix}
                onChange={setNewPrefix}
              />
            </div>
            <Button
              onClick={() => {
                if (newPrefix) addPrefixMutation.mutate(newPrefix);
              }}
              disabled={!newPrefix || addPrefixMutation.isPending}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>

          {/* List of trigger prefixes */}
          {triggerPrefixes && triggerPrefixes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix konta</TableHead>
                  <TableHead className="w-20">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggerPrefixes.map((tp: any) => (
                  <TableRow key={tp.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{tp.account_number_prefix}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePrefixMutation.mutate(tp.id)}
                        disabled={removePrefixMutation.isPending}
                        className="text-destructive hover:text-destructive/80"
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
              Brak zdefiniowanych prefiksów kont wyzwalających. Dodaj prefiksy powyżej.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProvincialFeeManagement;
