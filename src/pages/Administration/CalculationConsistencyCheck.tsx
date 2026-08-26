import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, FileSpreadsheet, Play, TriangleAlert } from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import { getFirstDayOfMonth, getLastDayOfMonth } from '@/utils/dateUtils';
import { LocationLike } from '@/utils/locationAccountMatching';
import { EngineTx } from '@/utils/turnoverEngine';
import {
  Discrepancy,
  checkRowsSumEqualsTotal,
  findDiscrepancies,
} from '@/utils/consistencyCheck';
import {
  fetchAccountIdsForPrefix,
  fetchTransactionsForAccountIds,
} from '@/utils/turnoverFetch';

const DEFAULT_PREFIXES = ['100', '101', '110', '200', '201', '210', '400', '700'];

const FIELD_LABELS: Record<string, string> = {
  opening: 'Saldo początkowe',
  debit: 'Obroty Wn',
  credit: 'Obroty Ma',
  closing: 'Saldo końcowe',
};

const formatPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Kontrola krzyżowa obliczeń (pkt 2B wyceny).
 * Dla każdego bloku kont i każdego miesiąca porównuje dwie niezależne ścieżki
 * liczenia: agregację wg placówki (widok „Obroty i salda – globalnie”) oraz
 * agregację wg pełnych numerów kont (ścieżka modułu „Wyszukaj konta”).
 * Pusta lista różnic = wyliczenia w programie są zgodne.
 */
const CalculationConsistencyCheck: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [prefixesInput, setPrefixesInput] = useState(DEFAULT_PREFIXES.join(', '));
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [diffs, setDiffs] = useState<Discrepancy[] | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);

  const { data: locations = [] } = useQuery({
    queryKey: ['consistency-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, location_identifier')
        .order('location_identifier');
      if (error) throw error;
      return (data || []) as LocationLike[];
    },
  });

  const prefixes = useMemo(
    () =>
      prefixesInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    [prefixesInput]
  );

  const run = async () => {
    if (locations.length === 0) {
      toast.error('Brak listy placówek');
      return;
    }
    if (prefixes.length === 0) {
      toast.error('Podaj co najmniej jeden blok kont (np. 100, 201, 700)');
      return;
    }
    setIsRunning(true);
    setDiffs(null);
    setCheckedCount(0);
    const found: Discrepancy[] = [];
    let checks = 0;

    try {
      for (const prefix of prefixes) {
        setProgress(`Konto ${prefix} — pobieranie zapisów…`);
        const accountIds = await fetchAccountIdsForPrefix(prefix);
        if (accountIds.length === 0) continue;

        // Jedno pobranie na blok kont: wszystko do końca roku (salda + obroty).
        const all: EngineTx[] = await fetchTransactionsForAccountIds(
          accountIds,
          null,
          getLastDayOfMonth(year, 12)
        );

        for (let month = 1; month <= 12; month++) {
          setProgress(`Konto ${prefix} — miesiąc ${String(month).padStart(2, '0')}/${year}`);
          const from = getFirstDayOfMonth(year, month);
          const to = getLastDayOfMonth(year, month);
          const prevTx = all.filter((t) => t.date < from);
          const curTx = all.filter((t) => t.date >= from && t.date <= to);
          if (prevTx.length === 0 && curTx.length === 0) continue;

          const params = { prefix, month, locations, prevTx, curTx };
          found.push(...findDiscrepancies(params));
          found.push(...checkRowsSumEqualsTotal(params));
          checks += 1;
        }
      }

      setDiffs(found);
      setCheckedCount(checks);
      if (found.length === 0) {
        toast.success(`Zgodność potwierdzona — sprawdzono ${checks} okresów bez różnic`);
      } else {
        toast.warning(`Wykryto ${found.length} rozjazdów w ${checks} sprawdzonych okresach`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Błąd kontroli zgodności');
    } finally {
      setIsRunning(false);
      setProgress('');
    }
  };

  const exportDiffs = () => {
    const rows: (string | number)[][] = [
      ['Kontrola zgodności obliczeń', `Rok ${year}`],
      [],
      [
        'Konto',
        'Miesiąc',
        'Placówka',
        'Pozycja',
        'Wg placówki (globalnie)',
        'Wg kont (Wyszukaj konta)',
        'Różnica',
      ],
    ];
    (diffs || []).forEach((d) => {
      rows.push([
        d.prefix,
        String(d.month).padStart(2, '0'),
        d.locationName,
        FIELD_LABELS[d.field] || d.field,
        d.byLocation,
        d.byAccount,
        d.difference,
      ]);
    });
    if ((diffs || []).length === 0) rows.push(['Brak różnic — wyliczenia zgodne']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 9 },
      { wch: 32 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rozjazdy');
    XLSX.writeFile(wb, `kontrola_zgodnosci_${year}.xlsx`);
  };

  /** Pkt 2C — arkusz kontrolny do wpisania kwot z Symfonii. */
  const exportTemplate = () => {
    const header = [
      'Konto',
      'Placówka',
      'Miesiąc',
      'Saldo początkowe (Symfonia)',
      'Obroty Wn (Symfonia)',
      'Obroty Ma (Symfonia)',
      'Saldo końcowe (Symfonia)',
      'Uwagi / co się nie zgadza',
    ];
    const rows: (string | number)[][] = [
      ['Zestaw kontrolny — porównanie z Symfonią', `Rok ${year}`],
      [],
      [
        'Instrukcja: dla wskazanego konta i placówki wpisz kwoty z Symfonii.',
      ],
      [
        'Zgłaszając rozjazd podaj: konto, placówkę, miesiąc oraz kwotę różnicy — pozwoli to odtworzyć przypadek.',
      ],
      [],
      header,
    ];
    prefixes.forEach((prefix) => {
      locations.forEach((loc) => {
        rows.push([prefix, loc.name || '', '', '', '', '', '', '']);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 32 },
      { wch: 9 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Zestaw kontrolny');
    XLSX.writeFile(wb, `zestaw_kontrolny_${year}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontrola zgodności obliczeń</CardTitle>
        <p className="text-sm text-muted-foreground">
          Dla każdego bloku kont i każdego miesiąca porównywane są dwie niezależne ścieżki
          liczenia: obroty globalne (wg placówki) oraz obroty wg pełnych numerów kont (tak jak
          w module „Wyszukaj konta”). Brak różnic oznacza zgodność wyliczeń.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-sm">Rok</Label>
            <Input
              type="number"
              className="w-28"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || year)}
            />
          </div>
          <div className="flex-1 min-w-64">
            <Label className="text-sm">Bloki kont (oddzielone przecinkiem)</Label>
            <Input value={prefixesInput} onChange={(e) => setPrefixesInput(e.target.value)} />
          </div>
          <Button onClick={run} disabled={isRunning} className="gap-2">
            <Play className="h-4 w-4" />
            {isRunning ? 'Sprawdzanie…' : 'Uruchom kontrolę'}
          </Button>
          <Button variant="outline" onClick={exportTemplate} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Arkusz kontrolny (Symfonia)
          </Button>
          {diffs && (
            <Button variant="outline" onClick={exportDiffs} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Eksport wyniku
            </Button>
          )}
        </div>

        {isRunning && progress && (
          <p className="text-sm text-muted-foreground">{progress}</p>
        )}

        {diffs && diffs.length === 0 && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-50 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Zgodność potwierdzona — sprawdzono {checkedCount} okresów, brak różnic.
          </div>
        )}

        {diffs && diffs.length > 0 && (
          <>
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <TriangleAlert className="h-4 w-4 text-destructive" />
              Wykryto {diffs.length} rozjazdów (sprawdzono {checkedCount} okresów).
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Konto</TableHead>
                    <TableHead className="w-20">Miesiąc</TableHead>
                    <TableHead>Placówka</TableHead>
                    <TableHead className="w-40">Pozycja</TableHead>
                    <TableHead className="text-right w-36">Globalnie</TableHead>
                    <TableHead className="text-right w-36">Wg kont</TableHead>
                    <TableHead className="text-right w-32">Różnica</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.map((d, i) => (
                    <TableRow key={`${d.prefix}-${d.month}-${d.locationId}-${d.field}-${i}`}>
                      <TableCell className="font-mono">{d.prefix}</TableCell>
                      <TableCell>{String(d.month).padStart(2, '0')}</TableCell>
                      <TableCell>
                        {d.locationName}
                        {d.locationId === '__total__' && (
                          <Badge variant="outline" className="ml-2">
                            suma
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{FIELD_LABELS[d.field] || d.field}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPLN(d.byLocation)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPLN(d.byAccount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive font-medium">
                        {formatPLN(d.difference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CalculationConsistencyCheck;
