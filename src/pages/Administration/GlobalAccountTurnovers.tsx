import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/Spinner';
import { FileSpreadsheet, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import { fetchAllRows } from '@/utils/supabasePagination';
import { formatDateForDB, getFirstDayOfMonth, getLastDayOfMonth } from '@/utils/dateUtils';

type PeriodType = 'month' | 'quarter' | 'year';

interface LocationRow {
  id: string;
  name: string;
  location_identifier: string | null;
}

interface ResultRow {
  locationId: string;
  locationName: string;
  identifier: string;
  level: number; // 1 prowincja, 2 dom, 3 parafia, 4 dzieło
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Prowincja',
  2: 'Domy',
  3: 'Parafie',
  4: 'Dzieła OMI',
  0: 'Pozostałe',
};

const formatPLN = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const getLevel = (identifier: string | null): number => {
  if (!identifier) return 0;
  const first = identifier.charAt(0);
  const n = parseInt(first, 10);
  return isNaN(n) ? 0 : n;
};

const GlobalAccountTurnovers: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [accountPrefix, setAccountPrefix] = useState<string>('100');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [quarter, setQuarter] = useState<number>(Math.ceil(currentMonth / 3));
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Lista podpowiedzi: unikalne pierwsze segmenty wszystkich kont w bazie
  const { data: accountPrefixes } = useQuery({
    queryKey: ['global-account-prefixes'],
    queryFn: async () => {
      const rows = await fetchAllRows<{ number: string }>((from, to) =>
        supabase.from('accounts').select('number').order('number').range(from, to)
      );
      const set = new Set<string>();
      rows.forEach((r) => {
        const p = (r.number || '').split('-')[0];
        if (p) set.add(p);
      });
      return Array.from(set).sort();
    },
  });

  const { data: locations } = useQuery({
    queryKey: ['global-locations-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, location_identifier')
        .order('location_identifier', { ascending: true });
      if (error) throw error;
      return (data || []) as LocationRow[];
    },
  });

  const periodRange = useMemo(() => {
    if (periodType === 'year') {
      return {
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
        prevDate: `${year - 1}-12-31`,
      };
    }
    if (periodType === 'quarter') {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const prev = new Date(year, startMonth - 1, 0);
      return {
        dateFrom: getFirstDayOfMonth(year, startMonth),
        dateTo: getLastDayOfMonth(year, endMonth),
        prevDate: formatDateForDB(prev),
      };
    }
    const prev = new Date(year, month - 1, 0);
    return {
      dateFrom: getFirstDayOfMonth(year, month),
      dateTo: getLastDayOfMonth(year, month),
      prevDate: formatDateForDB(prev),
    };
  }, [periodType, year, month, quarter]);

  const runQuery = async () => {
    if (!accountPrefix.trim()) {
      toast.error('Wskaż numer konta (pierwszy segment, np. 100, 201, 401, 702)');
      return;
    }
    if (!locations) {
      toast.error('Brak listy placówek');
      return;
    }
    setIsRunning(true);
    try {
      const prefix = accountPrefix.trim();
      const { dateFrom, dateTo, prevDate } = periodRange;

      // 1) Salda otwarcia — wszystkie transakcje do prevDate, dla wszystkich placówek.
      const prevTx = await fetchAllRows<any>((from, to) =>
        supabase
          .from('transactions')
          .select(
            `location_id, debit_amount, credit_amount, currency, exchange_rate,
             debit_account:accounts!transactions_debit_account_id_fkey(number),
             credit_account:accounts!transactions_credit_account_id_fkey(number)`
          )
          .lte('date', prevDate)
          .order('date', { ascending: true })
          .range(from, to)
      );

      // 2) Obroty bieżące — w wybranym zakresie
      const curTx = await fetchAllRows<any>((from, to) =>
        supabase
          .from('transactions')
          .select(
            `location_id, debit_amount, credit_amount, currency, exchange_rate,
             debit_account:accounts!transactions_debit_account_id_fkey(number),
             credit_account:accounts!transactions_credit_account_id_fkey(number)`
          )
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date', { ascending: true })
          .range(from, to)
      );

      const toPLN = (amount: number, currency?: string, rate?: number) => {
        if (!currency || currency === 'PLN' || !rate || rate === 1) return amount || 0;
        return (amount || 0) * rate;
      };

      const opening = new Map<string, number>();
      const debit = new Map<string, number>();
      const credit = new Map<string, number>();

      const matchesPrefix = (num?: string) =>
        !!num && num.split('-')[0] === prefix;

      prevTx.forEach((tx) => {
        const r = tx.exchange_rate || 1;
        const c = tx.currency || 'PLN';
        const locId = tx.location_id;
        if (!locId) return;
        if (matchesPrefix(tx.debit_account?.number)) {
          opening.set(locId, (opening.get(locId) || 0) + toPLN(tx.debit_amount, c, r));
        }
        if (matchesPrefix(tx.credit_account?.number)) {
          opening.set(locId, (opening.get(locId) || 0) - toPLN(tx.credit_amount, c, r));
        }
      });

      curTx.forEach((tx) => {
        const r = tx.exchange_rate || 1;
        const c = tx.currency || 'PLN';
        const locId = tx.location_id;
        if (!locId) return;
        if (matchesPrefix(tx.debit_account?.number)) {
          debit.set(locId, (debit.get(locId) || 0) + toPLN(tx.debit_amount, c, r));
        }
        if (matchesPrefix(tx.credit_account?.number)) {
          credit.set(locId, (credit.get(locId) || 0) + toPLN(tx.credit_amount, c, r));
        }
      });

      const rows: ResultRow[] = locations.map((loc) => {
        const op = opening.get(loc.id) || 0;
        const d = debit.get(loc.id) || 0;
        const cr = credit.get(loc.id) || 0;
        return {
          locationId: loc.id,
          locationName: loc.name,
          identifier: loc.location_identifier || '',
          level: getLevel(loc.location_identifier),
          opening: op,
          debit: d,
          credit: cr,
          closing: op + d - cr,
        };
      });

      // Pokaż tylko placówki, które mają jakąkolwiek aktywność lub niezerowe saldo
      const filtered = rows.filter(
        (r) => Math.abs(r.opening) > 0.005 || Math.abs(r.debit) > 0.005 || Math.abs(r.credit) > 0.005
      );
      setResults(filtered);
      if (filtered.length === 0) {
        toast.info('Brak obrotów i sald na wskazanym koncie w wybranym okresie');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Błąd zapytania: ' + (err?.message || 'nieznany'));
    } finally {
      setIsRunning(false);
    }
  };

  const grouped = useMemo(() => {
    if (!results) return null;
    const byLevel = new Map<number, ResultRow[]>();
    results.forEach((r) => {
      const arr = byLevel.get(r.level) || [];
      arr.push(r);
      byLevel.set(r.level, arr);
    });
    const order = [1, 2, 3, 4, 0];
    return order
      .filter((l) => byLevel.has(l))
      .map((l) => ({
        level: l,
        label: LEVEL_LABELS[l],
        rows: (byLevel.get(l) || []).sort((a, b) =>
          a.identifier.localeCompare(b.identifier, 'pl', { numeric: true })
        ),
      }));
  }, [results]);

  const totals = useMemo(() => {
    if (!results) return null;
    return results.reduce(
      (acc, r) => ({
        opening: acc.opening + r.opening,
        debit: acc.debit + r.debit,
        credit: acc.credit + r.credit,
        closing: acc.closing + r.closing,
      }),
      { opening: 0, debit: 0, credit: 0, closing: 0 }
    );
  }, [results]);

  const exportXlsx = () => {
    if (!grouped || !totals) return;
    const periodLabel =
      periodType === 'year'
        ? `${year}`
        : periodType === 'quarter'
          ? `Q${quarter} ${year}`
          : `${String(month).padStart(2, '0')}/${year}`;

    const data: any[][] = [];
    data.push([`Obroty i salda — konto ${accountPrefix}, okres ${periodLabel}`]);
    data.push([]);
    data.push([
      'Identyfikator',
      'Placówka',
      'Saldo początkowe',
      'Obroty Wn',
      'Obroty Ma',
      'Saldo końcowe',
    ]);

    grouped.forEach((group) => {
      data.push([`-- ${group.label} --`]);
      group.rows.forEach((r) =>
        data.push([r.identifier, r.locationName, r.opening, r.debit, r.credit, r.closing])
      );
      const sub = group.rows.reduce(
        (acc, r) => ({
          opening: acc.opening + r.opening,
          debit: acc.debit + r.debit,
          credit: acc.credit + r.credit,
          closing: acc.closing + r.closing,
        }),
        { opening: 0, debit: 0, credit: 0, closing: 0 }
      );
      data.push(['', `Razem: ${group.label}`, sub.opening, sub.debit, sub.credit, sub.closing]);
      data.push([]);
    });

    data.push(['', 'RAZEM (wszystkie placówki)', totals.opening, totals.debit, totals.credit, totals.closing]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 14 }, { wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        const isNum = typeof cell.v === 'number';
        cell.s = {
          font: { sz: 10 },
          ...(isNum ? { numFmt: '#,##0.00 "zł"' } : {}),
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Konto ${accountPrefix}`);
    XLSX.writeFile(wb, `obroty_konto_${accountPrefix}_${periodLabel.replace(/[\s/]/g, '_')}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obroty i salda — globalnie po placówkach</CardTitle>
        <p className="text-sm text-muted-foreground">
          Zestawienie obrotów i sald wybranego konta syntetycznego (np. 100, 201, 401, 702)
          w wybranym okresie, pogrupowane według poziomu placówki (prowincja, domy, parafie, dzieła).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="acc">Konto (pierwszy segment)</Label>
            <Input
              id="acc"
              value={accountPrefix}
              onChange={(e) => setAccountPrefix(e.target.value)}
              list="account-prefix-list"
              placeholder="np. 100, 201, 401, 702"
            />
            <datalist id="account-prefix-list">
              {(accountPrefixes || []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label>Zakres</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Miesiąc</SelectItem>
                <SelectItem value="quarter">Kwartał</SelectItem>
                <SelectItem value="year">Rok</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rok</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, i) => currentYear - 4 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {periodType === 'month' && (
            <div className="space-y-2">
              <Label>Miesiąc</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {String(m).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodType === 'quarter' && (
            <div className="space-y-2">
              <Label>Kwartał</Label>
              <Select value={String(quarter)} onValueChange={(v) => setQuarter(parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((q) => (
                    <SelectItem key={q} value={String(q)}>
                      Q{q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 flex flex-col justify-end">
            <Button onClick={runQuery} disabled={isRunning} className="gap-2">
              {isRunning ? <Spinner /> : <Search className="h-4 w-4" />}
              Pokaż
            </Button>
          </div>
        </div>

        {results && grouped && totals && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportXlsx} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Eksport do Excela
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Identyfikator</TableHead>
                  <TableHead>Placówka</TableHead>
                  <TableHead className="text-right">Saldo początkowe</TableHead>
                  <TableHead className="text-right">Obroty Wn</TableHead>
                  <TableHead className="text-right">Obroty Ma</TableHead>
                  <TableHead className="text-right">Saldo końcowe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((group) => {
                  const sub = group.rows.reduce(
                    (acc, r) => ({
                      opening: acc.opening + r.opening,
                      debit: acc.debit + r.debit,
                      credit: acc.credit + r.credit,
                      closing: acc.closing + r.closing,
                    }),
                    { opening: 0, debit: 0, credit: 0, closing: 0 }
                  );
                  return (
                    <React.Fragment key={group.level}>
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={6} className="font-semibold">
                          {group.label}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((r) => (
                        <TableRow key={r.locationId}>
                          <TableCell className="font-mono text-xs">{r.identifier}</TableCell>
                          <TableCell>{r.locationName}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPLN(r.opening)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPLN(r.debit)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPLN(r.credit)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatPLN(r.closing)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={2} className="font-semibold text-right">
                          Razem: {group.label}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatPLN(sub.opening)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatPLN(sub.debit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatPLN(sub.credit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatPLN(sub.closing)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}

                <TableRow className="border-t-2">
                  <TableCell colSpan={2} className="font-bold text-right">
                    RAZEM (wszystkie placówki)
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatPLN(totals.opening)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatPLN(totals.debit)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatPLN(totals.credit)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatPLN(totals.closing)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GlobalAccountTurnovers;