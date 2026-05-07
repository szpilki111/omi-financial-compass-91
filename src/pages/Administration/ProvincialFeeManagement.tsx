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
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

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
      // Fetch ALL accounts using pagination to bypass 1000-row limit
      const allAccounts: { number: string; name: string }[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('accounts')
          .select('number, name')
          .eq('is_active', true)
          .order('number')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allAccounts.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      return allAccounts;
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

  const DISPLAY_LIMIT = 20;

  const filtered = useMemo(() => {
    let result = uniquePrefixes;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = uniquePrefixes.filter(
        (p) => p.prefix.includes(term) || p.name.toLowerCase().includes(term)
      );
    }
    return result.slice(0, DISPLAY_LIMIT);
  }, [uniquePrefixes, searchTerm]);

  const totalMatching = useMemo(() => {
    if (!searchTerm.trim()) return uniquePrefixes.length;
    const term = searchTerm.toLowerCase();
    return uniquePrefixes.filter(
      (p) => p.prefix.includes(term) || p.name.toLowerCase().includes(term)
    ).length;
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
              {totalMatching > DISPLAY_LIMIT && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center border-t">
                  Wyświetlono {DISPLAY_LIMIT} z {totalMatching} prefiksów. Wpisz więcej znaków aby zawęzić wyniki.
                </div>
              )}
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
        .select('id, account_number_prefix, fee_percentage');
      if (error) throw error;
      return data;
    },
  });

  // Locations for exclusion dialog
  const { data: locations } = useQuery({
    queryKey: ['locations-for-fee-exclusions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Exclusions
  const { data: exclusions } = useQuery({
    queryKey: ['provincialFeeAccountExclusions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_account_exclusions')
        .select('id, provincial_fee_account_id, location_id');
      if (error) throw error;
      return data || [];
    },
  });

  // Local state for inline % editing per row
  const [percentEdits, setPercentEdits] = React.useState<Record<string, string>>({});
  // Local state for inline subaccount editing (Wn / Ma) per row
  const [subEdits, setSubEdits] = React.useState<Record<string, { debit: string; credit: string }>>({});

  // Exclusions dialog state
  const [exclusionsForId, setExclusionsForId] = React.useState<string | null>(null);

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

  // Update per-account fee percentage
  const updatePercentMutation = useMutation({
    mutationFn: async ({ id, fee_percentage }: { id: string; fee_percentage: number | null }) => {
      const { error } = await supabase
        .from('provincial_fee_accounts')
        .update({ fee_percentage })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccounts'] });
      toast({ title: 'Zapisano', description: 'Procent dla konta został zaktualizowany' });
    },
    onError: (error: any) => {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    },
  });

  // Update per-account target sub-segments (analytical part appended to debit/credit prefix)
  const updateSubaccountsMutation = useMutation({
    mutationFn: async ({ id, target_debit_subaccount, target_credit_subaccount }: { id: string; target_debit_subaccount: string | null; target_credit_subaccount: string | null }) => {
      const { error } = await supabase
        .from('provincial_fee_accounts')
        .update({ target_debit_subaccount, target_credit_subaccount })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccounts'] });
      toast({ title: 'Zapisano', description: 'Analityka kont docelowych została zaktualizowana' });
    },
    onError: (error: any) => {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle exclusion (location for trigger account)
  const toggleExclusionMutation = useMutation({
    mutationFn: async ({ accountId, locationId, exclude }: { accountId: string; locationId: string; exclude: boolean }) => {
      if (exclude) {
        const { error } = await supabase
          .from('provincial_fee_account_exclusions')
          .insert({ provincial_fee_account_id: accountId, location_id: locationId });
        if (error && !String(error.message).includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('provincial_fee_account_exclusions')
          .delete()
          .eq('provincial_fee_account_id', accountId)
          .eq('location_id', locationId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provincialFeeAccountExclusions'] });
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
                  <TableHead className="w-40">Indywidualny % opłaty</TableHead>
                  <TableHead className="w-56">Analityka konta docelowego (Wn / Ma)</TableHead>
                  <TableHead className="w-48">Wykluczone lokalizacje</TableHead>
                  <TableHead className="w-20">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggerPrefixes.map((tp: any) => {
                  const exclCount = (exclusions || []).filter((e: any) => e.provincial_fee_account_id === tp.id).length;
                  const editValue = percentEdits[tp.id];
                  const currentValue = editValue !== undefined
                    ? editValue
                    : (tp.fee_percentage != null ? String(tp.fee_percentage) : '');
                  const subEdit = subEdits[tp.id];
                  const debitSub = subEdit?.debit ?? (tp.target_debit_subaccount ?? '');
                  const creditSub = subEdit?.credit ?? (tp.target_credit_subaccount ?? '');
                  return (
                    <TableRow key={tp.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{tp.account_number_prefix}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder={`globalny: ${feePercentage || '0'}`}
                            value={currentValue}
                            onChange={(e) => setPercentEdits((prev) => ({ ...prev, [tp.id]: e.target.value }))}
                            className="w-28 h-8"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatePercentMutation.isPending}
                            onClick={() => {
                              const raw = currentValue.trim();
                              const val = raw === '' ? null : parseFloat(raw.replace(',', '.'));
                              if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
                                toast({ title: 'Błąd', description: 'Procent musi być między 0 a 100', variant: 'destructive' });
                                return;
                              }
                              updatePercentMutation.mutate({ id: tp.id, fee_percentage: val });
                              setPercentEdits((prev) => { const c = { ...prev }; delete c[tp.id]; return c; });
                            }}
                          >
                            Zapisz
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder="Wn np. 3"
                            value={debitSub}
                            onChange={(e) => setSubEdits((prev) => ({
                              ...prev,
                              [tp.id]: { debit: e.target.value, credit: prev[tp.id]?.credit ?? (tp.target_credit_subaccount ?? '') },
                            }))}
                            className="w-20 h-8 font-mono"
                          />
                          <span className="text-muted-foreground">/</span>
                          <Input
                            placeholder="Ma np. 1"
                            value={creditSub}
                            onChange={(e) => setSubEdits((prev) => ({
                              ...prev,
                              [tp.id]: { debit: prev[tp.id]?.debit ?? (tp.target_debit_subaccount ?? ''), credit: e.target.value },
                            }))}
                            className="w-20 h-8 font-mono"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateSubaccountsMutation.isPending}
                            onClick={() => {
                              updateSubaccountsMutation.mutate({
                                id: tp.id,
                                target_debit_subaccount: debitSub.trim() || null,
                                target_credit_subaccount: creditSub.trim() || null,
                              });
                              setSubEdits((prev) => { const c = { ...prev }; delete c[tp.id]; return c; });
                            }}
                          >
                            Zapisz
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExclusionsForId(tp.id)}
                          className="flex items-center gap-2"
                        >
                          <Building2 className="h-4 w-4" />
                          {exclCount > 0 ? `${exclCount} wykluczonych` : 'Zarządzaj'}
                        </Button>
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
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Brak zdefiniowanych prefiksów kont wyzwalających. Dodaj prefiksy powyżej.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exclusions dialog */}
      <Dialog open={!!exclusionsForId} onOpenChange={(o) => !o && setExclusionsForId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wykluczone lokalizacje</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Zaznaczone lokalizacje nie będą miały automatycznie naliczanej opłaty prowincjalnej dla tego konta.
          </p>
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {(locations || []).map((loc: any) => {
              const isExcluded = (exclusions || []).some(
                (e: any) => e.provincial_fee_account_id === exclusionsForId && e.location_id === loc.id
              );
              return (
                <div key={loc.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`excl-${loc.id}`}
                    checked={isExcluded}
                    onCheckedChange={(checked) => {
                      if (!exclusionsForId) return;
                      toggleExclusionMutation.mutate({
                        accountId: exclusionsForId,
                        locationId: loc.id,
                        exclude: !!checked,
                      });
                    }}
                  />
                  <Label htmlFor={`excl-${loc.id}`} className="cursor-pointer font-normal">{loc.name}</Label>
                </div>
              );
            })}
            {(!locations || locations.length === 0) && (
              <p className="text-sm text-muted-foreground">Brak lokalizacji.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusionsForId(null)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProvincialFeeManagement;
