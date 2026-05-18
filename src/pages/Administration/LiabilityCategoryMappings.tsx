import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  loans_given: '1. Pożyczki udzielone',
  loans_taken: '2. Pożyczki zaciągnięte',
  province: '3. Rozliczenia z prowincją',
  province_benefits: '4. Świadczenia na rzecz prowincji',
  others: '5. Rozliczenia z innymi',
};

const CATEGORY_KEYS = ['loans_given', 'loans_taken', 'province', 'province_benefits', 'others'] as const;

const LiabilityCategoryMappings: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('GLOBAL');
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: locations } = useQuery({
    queryKey: ['locations-for-liability-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['liability-category-mappings-admin', selectedLocationId],
    queryFn: async () => {
      const isGlobal = selectedLocationId === 'GLOBAL';
      const query = supabase
        .from('report_liability_category_mappings')
        .select('id, category_key, account_prefixes, location_id, display_order');
      const { data, error } = isGlobal
        ? await query.is('location_id', null)
        : await query.eq('location_id', selectedLocationId);
      if (error) throw error;
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ category_key, prefixesText }: { category_key: string; prefixesText: string }) => {
      const prefixes = prefixesText.split(',').map((s) => s.trim()).filter(Boolean);
      const isGlobal = selectedLocationId === 'GLOBAL';
      const existing = mappings?.find((m: any) => m.category_key === category_key);
      if (existing) {
        const { error } = await supabase
          .from('report_liability_category_mappings')
          .update({ account_prefixes: prefixes })
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('report_liability_category_mappings')
          .insert({
            location_id: isGlobal ? null : selectedLocationId,
            category_key,
            account_prefixes: prefixes,
            display_order: CATEGORY_KEYS.indexOf(category_key as any) + 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['liability-category-mappings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['report-liability-mappings'] });
      setEdits((prev) => { const c = { ...prev }; delete c[vars.category_key]; return c; });
      toast({ title: 'Zapisano', description: 'Mapowanie kategorii zostało zaktualizowane' });
    },
    onError: (e: any) => toast({ title: 'Błąd', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapowanie kategorii „Należności i zobowiązania" w raporcie</CardTitle>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Zdefiniuj numery kont dla każdej kategorii sekcji C raportu. Mapowanie globalne (bez wyboru placówki)
            służy jako wartość domyślna; dla konkretnej placówki możesz nadpisać konkretne kategorie. Wiele wpisów rozdziel przecinkami.
          </p>
          <p>
            <strong>Składnia dopasowania:</strong>
          </p>
          <ul className="list-disc list-inside ml-2">
            <li><code className="font-mono">201</code> — wszystkie konta zaczynające się od <code>201-</code> (pierwszy segment)</li>
            <li><code className="font-mono">201-2-10</code> — DOKŁADNIE to konto (bez subkont <code>201-2-10-*</code>)</li>
            <li><code className="font-mono">201-2-10-*</code> — to konto ORAZ wszystkie jego subkonta</li>
          </ul>
          <p className="text-xs italic">
            Przykład: aby w „Rozliczenia z prowincją" widzieć tylko 201-X-10, a świadczenia parafii / fundację mieć
            w osobnym wierszu — wpisz w „Rozliczenia z prowincją" np. <code>201-2-10</code>, a w „Świadczenia na rzecz prowincji"
            np. <code>201-2-10-1, 201-2-10-2</code> (lub odpowiednie pełne numery subkont).
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-md">
          <Label>Placówka</Label>
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GLOBAL">— Wartości domyślne (wszystkie placówki) —</SelectItem>
              {(locations || []).map((l: any) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2"><Spinner /><span>Ładowanie...</span></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategoria</TableHead>
                <TableHead>Numery / prefiksy kont (rozdzielone przecinkami)</TableHead>
                <TableHead className="w-32">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORY_KEYS.map((key) => {
                const existing = mappings?.find((m: any) => m.category_key === key);
                const currentValue = edits[key] !== undefined
                  ? edits[key]
                  : ((existing as any)?.account_prefixes || []).join(', ');
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{CATEGORY_LABELS[key]}</TableCell>
                    <TableCell>
                      <Input
                        value={currentValue}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="np. 200, 201-2-15"
                        className="font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={upsertMutation.isPending}
                        onClick={() => upsertMutation.mutate({ category_key: key, prefixesText: currentValue })}
                      >
                        <Save className="h-3 w-3 mr-1" /> Zapisz
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default LiabilityCategoryMappings;