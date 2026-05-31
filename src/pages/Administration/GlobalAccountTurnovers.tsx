import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/Spinner';
import { FileSpreadsheet, Search, Eye, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { fetchAllRows } from '@/utils/supabasePagination';
import { formatDateForDB, getFirstDayOfMonth, getLastDayOfMonth } from '@/utils/dateUtils';

type PeriodType = 'month' | 'quarter' | 'year';

interface LocationRow {
  id: string;
  name: string;
  location_identifier: string | null;
}

interface TxRow {
  id: string;
  date: string;
  description: string | null;
  location_id: string;
  debit_amount: number;
  credit_amount: number;
  currency: string | null;
  exchange_rate: number | null;
  document_id: string | null;
  debit_account: { number: string } | null;
  credit_account: { number: string } | null;
  document: { document_number: string } | null;
}

interface ResultRow {
  locationId: string;
  locationName: string;
  identifier: string;
  level: number;
  accountNumber?: string; // when grouped per pełne konto
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

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  'hsl(var(--muted-foreground))',
  'hsl(210 70% 50%)',
  'hsl(35 85% 55%)',
  'hsl(150 60% 45%)',
  'hsl(280 60% 55%)',
];

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

const toPLN = (amount: number, currency?: string | null, rate?: number | null) => {
  if (!currency || currency === 'PLN' || !rate || rate === 1) return amount || 0;
  return (amount || 0) * rate;
};

const GlobalAccountTurnovers: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [accountPrefix, setAccountPrefix] = useState<string>('100');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [quarter, setQuarter] = useState<number>(Math.ceil(currentMonth / 3));
  const [perAccount, setPerAccount] = useState<boolean>(false);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [curTxState, setCurTxState] = useState<TxRow[]>([]);
  const [drillRow, setDrillRow] = useState<ResultRow | null>(null);

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

  const periodLabel = useMemo(() => {
    if (periodType === 'year') return `${year}`;
    if (periodType === 'quarter') return `Q${quarter} ${year}`;
    return `${String(month).padStart(2, '0')}/${year}`;
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

      const selectFields = `id, date, description, location_id, debit_amount, credit_amount, currency, exchange_rate, document_id,
         debit_account:accounts!transactions_debit_account_id_fkey(number),
         credit_account:accounts!transactions_credit_account_id_fkey(number),
         document:documents(document_number)`;

      const prevTx = await fetchAllRows<TxRow>((from, to) =>
        supabase
          .from('transactions')
          .select(selectFields)
          .lte('date', prevDate)
          .order('date', { ascending: true })
          .range(from, to)
      );

      const curTx = await fetchAllRows<TxRow>((from, to) =>
        supabase
          .from('transactions')
          .select(selectFields)
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date', { ascending: true })
          .range(from, to)
      );

      const matchesPrefix = (num?: string | null) =>
        !!num && num.split('-')[0] === prefix;

      // Key builder: per pełne konto albo per placówka
      const keyFor = (locId: string, accNumber?: string | null): string =>
        perAccount && accNumber ? `${locId}__${accNumber}` : locId;

      const opening = new Map<string, number>();
      const debit = new Map<string, number>();
      const credit = new Map<string, number>();
      const accountFor = new Map<string, string>(); // key → fullAccountNumber (gdy perAccount)
      const locFor = new Map<string, string>(); // key → locationId

      const apply = (
        tx: TxRow,
        target: Map<string, number>,
        side: 'debit' | 'credit',
        sign: 1 | -1
      ) => {
        const r = tx.exchange_rate || 1;
        const c = tx.currency || 'PLN';
        const locId = tx.location_id;
        if (!locId) return;
        const accNumber = side === 'debit' ? tx.debit_account?.number : tx.credit_account?.number;
        if (!matchesPrefix(accNumber)) return;
        const key = keyFor(locId, accNumber);
        const amt = side === 'debit' ? tx.debit_amount : tx.credit_amount;
        target.set(key, (target.get(key) || 0) + sign * toPLN(amt, c, r));
        if (!locFor.has(key)) locFor.set(key, locId);
        if (perAccount && accNumber) accountFor.set(key, accNumber);
      };

      prevTx.forEach((tx) => {
        apply(tx, opening, 'debit', 1);
        apply(tx, opening, 'credit', -1);
      });

      curTx.forEach((tx) => {
        apply(tx, debit, 'debit', 1);
        apply(tx, credit, 'credit', 1);
      });

      // Suma wszystkich kluczy z dowolnej mapy
      const allKeys = new Set<string>([
        ...Array.from(opening.keys()),
        ...Array.from(debit.keys()),
        ...Array.from(credit.keys()),
      ]);

      const locById = new Map(locations.map((l) => [l.id, l]));

      const rows: ResultRow[] = Array.from(allKeys).map((key) => {
        const locId = locFor.get(key) || key.split('__')[0];
        const loc = locById.get(locId);
        const op = opening.get(key) || 0;
        const d = debit.get(key) || 0;
        const cr = credit.get(key) || 0;
        return {
          locationId: locId,
          locationName: loc?.name || '(nieznana)',
          identifier: loc?.location_identifier || '',
          level: getLevel(loc?.location_identifier || null),
          accountNumber: perAccount ? accountFor.get(key) : undefined,
          opening: op,
          debit: d,
          credit: cr,
          closing: op + d - cr,
        };
      });

      const filtered = rows.filter(
        (r) =>
          Math.abs(r.opening) > 0.005 ||
          Math.abs(r.debit) > 0.005 ||
          Math.abs(r.credit) > 0.005
      );

      const byLocation =
        locationFilter === 'all' ? filtered : filtered.filter((r) => r.locationId === locationFilter);

      setResults(byLocation);
      setCurTxState(curTx);
      if (byLocation.length === 0) {
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
        rows: (byLevel.get(l) || []).sort((a, b) => {
          const cmp = a.identifier.localeCompare(b.identifier, 'pl', { numeric: true });
          if (cmp !== 0) return cmp;
          return (a.accountNumber || '').localeCompare(b.accountNumber || '', 'pl', { numeric: true });
        }),
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

  // === Wykresy ===
  const barData = useMemo(() => {
    if (!results) return [];
    return results
      .filter((r) => Math.abs(r.closing) > 0.01)
      .sort((a, b) => Math.abs(b.closing) - Math.abs(a.closing))
      .slice(0, 30)
      .map((r) => ({
        id: `${r.locationId}_${r.accountNumber || ''}`,
        name: r.accountNumber || r.identifier || r.locationName,
        locationName: r.locationName,
        closing: r.closing,
      }));
  }, [results]);

  const barShownInfo = useMemo(() => {
    if (!results) return null;
    const total = results.filter((r) => Math.abs(r.closing) > 0.01).length;
    return total > 30 ? `Pokazano 30 z ${total}` : null;
  }, [results]);

  const pieData = useMemo(() => {
    if (!results) return [];
    const all = results
      .map((r) => ({ name: r.identifier || r.locationName, value: r.debit + r.credit }))
      .filter((r) => r.value > 0.01)
      .sort((a, b) => b.value - a.value);
    const top = all.slice(0, 8);
    const restSum = all.slice(8).reduce((s, r) => s + r.value, 0);
    if (restSum > 0.01) top.push({ name: 'Pozostałe', value: restSum });
    const sum = top.reduce((s, r) => s + r.value, 0) || 1;
    return top.map((r) => ({ ...r, pct: (r.value / sum) * 100 }));
  }, [results]);

  // === Drill-down ===
  const drillTransactions = useMemo(() => {
    if (!drillRow) return [];
    const prefix = accountPrefix.trim();
    return curTxState
      .filter((tx) => {
        if (tx.location_id !== drillRow.locationId) return false;
        const d = tx.debit_account?.number;
        const c = tx.credit_account?.number;
        const matchesAccount = (acc?: string | null) => {
          if (!acc) return false;
          if (drillRow.accountNumber) return acc === drillRow.accountNumber;
          return acc.split('-')[0] === prefix;
        };
        return matchesAccount(d) || matchesAccount(c);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [drillRow, curTxState, accountPrefix]);

  const drillTotals = useMemo(() => {
    if (!drillRow) return { debit: 0, credit: 0 };
    const prefix = accountPrefix.trim();
    let dSum = 0;
    let cSum = 0;
    drillTransactions.forEach((tx) => {
      const r = tx.exchange_rate || 1;
      const ccy = tx.currency || 'PLN';
      const matchesAccount = (acc?: string | null) => {
        if (!acc) return false;
        if (drillRow.accountNumber) return acc === drillRow.accountNumber;
        return acc.split('-')[0] === prefix;
      };
      if (matchesAccount(tx.debit_account?.number)) dSum += toPLN(tx.debit_amount, ccy, r);
      if (matchesAccount(tx.credit_account?.number)) cSum += toPLN(tx.credit_amount, ccy, r);
    });
    return { debit: dSum, credit: cSum };
  }, [drillTransactions, drillRow, accountPrefix]);

  const openInAccountsModule = (row: ResultRow) => {
    const params = new URLSearchParams();
    params.set('account', row.accountNumber || accountPrefix);
    params.set('year', String(year));
    navigate(`/wyszukaj-konta?${params.toString()}`);
  };

  // === Eksport XLSX (multi-sheet) ===
  const exportXlsx = () => {
    if (!grouped || !totals) return;

    const header = perAccount
      ? ['Identyfikator', 'Placówka', 'Konto', 'Saldo początkowe', 'Obroty Wn', 'Obroty Ma', 'Saldo końcowe']
      : ['Identyfikator', 'Placówka', 'Saldo początkowe', 'Obroty Wn', 'Obroty Ma', 'Saldo końcowe'];

    const buildSheet = (rowsForSheet: ResultRow[], title: string): XLSX.WorkSheet => {
      const data: any[][] = [];
      data.push([title]);
      data.push([]);
      data.push(header);
      let openSum = 0;
      let dSum = 0;
      let cSum = 0;
      let clSum = 0;
      rowsForSheet.forEach((r) => {
        const baseRow = perAccount
          ? [r.identifier, r.locationName, r.accountNumber || '', r.opening, r.debit, r.credit, r.closing]
          : [r.identifier, r.locationName, r.opening, r.debit, r.credit, r.closing];
        data.push(baseRow);
        openSum += r.opening;
        dSum += r.debit;
        cSum += r.credit;
        clSum += r.closing;
      });
      const totalRow = perAccount
        ? ['', 'RAZEM', '', openSum, dSum, cSum, clSum]
        : ['', 'RAZEM', openSum, dSum, cSum, clSum];
      data.push([]);
      data.push(totalRow);

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = perAccount
        ? [{ wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
        : [{ wch: 14 }, { wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

      const range = XLSX.utils.decode_range(ws['!ref']!);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (!cell) continue;
          const isNum = typeof cell.v === 'number';
          const isHeader = R === 2;
          const isTotal = R === range.e.r;
          cell.s = {
            font: { sz: 10, bold: isHeader || isTotal || R === 0 },
            ...(isNum ? { numFmt: '#,##0.00 "zł"' } : {}),
          };
        }
      }
      return ws;
    };

    const wb = XLSX.utils.book_new();

    // 1) Razem
    const allRows = grouped.flatMap((g) => g.rows);
    XLSX.utils.book_append_sheet(
      wb,
      buildSheet(allRows, `Obroty i salda — konto ${accountPrefix}, okres ${periodLabel}`),
      'Razem'
    );

    // 2) Per poziom
    grouped.forEach((g) => {
      XLSX.utils.book_append_sheet(
        wb,
        buildSheet(g.rows, `${g.label} — konto ${accountPrefix}, ${periodLabel}`),
        g.label.substring(0, 28)
      );
    });

    // 3) Per konto (gdy włączone)
    if (perAccount) {
      XLSX.utils.book_append_sheet(
        wb,
        buildSheet(allRows, `Per konto — ${accountPrefix}, ${periodLabel}`),
        'Per konto'
      );
    }

    XLSX.writeFile(
      wb,
      `obroty_konto_${accountPrefix}_${periodLabel.replace(/[\s/]/g, '_')}.xlsx`
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obroty i salda — globalnie po placówkach</CardTitle>
        <p className="text-sm text-muted-foreground">
          Zestawienie obrotów i sald wybranego konta syntetycznego (np. 100, 201, 401, 702)
          w wybranym okresie, pogrupowane według poziomu placówki (prowincja, domy, parafie, dzieła).
          Przełącznik „per pełne konto" rozbija agregację po pełnym numerze konta (np. 201-…-1, 201-…-2).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-6">
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

          <div className="space-y-2">
            <Label>Placówka (opcjonalnie)</Label>
            <Select value={locationFilter} onValueChange={(v) => setLocationFilter(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie placówki</SelectItem>
                {(locations || []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.location_identifier ? `[${l.location_identifier}] ` : ''}
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 flex flex-col justify-end">
            <Button onClick={runQuery} disabled={isRunning} className="gap-2">
              {isRunning ? <Spinner /> : <Search className="h-4 w-4" />}
              Pokaż
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="per-account" checked={perAccount} onCheckedChange={setPerAccount} />
          <Label htmlFor="per-account" className="cursor-pointer">
            Pokaż per pełne konto (rozbicie 201-…-1, 201-…-2)
          </Label>
        </div>

        {results && grouped && totals && results.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportXlsx} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Eksport do Excela (wiele arkuszy)
              </Button>
            </div>

            {/* WYKRESY */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Salda końcowe (placówki)</CardTitle>
                  {barShownInfo && (
                    <p className="text-xs text-muted-foreground">{barShownInfo}</p>
                  )}
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        height={60}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat('pl-PL', { notation: 'compact' }).format(v)
                        }
                      />
                      <Tooltip
                        formatter={(value: any) => formatPLN(Number(value))}
                        labelFormatter={(label: any, payload: any) => {
                          const p = payload?.[0]?.payload;
                          return p?.locationName || label;
                        }}
                        contentStyle={{
                          background: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="closing">
                        {barData.map((r) => (
                          <Cell
                            key={r.id}
                            fill={r.closing >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Udział w obrotach (Wn + Ma)</CardTitle>
                  <p className="text-xs text-muted-foreground">Top 8 placówek + „Pozostałe"</p>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(entry: any) => `${entry.name} (${entry.pct.toFixed(1)}%)`}
                        labelLine={false}
                      >
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, _name: any, item: any) =>
                          `${formatPLN(Number(value))} (${item?.payload?.pct?.toFixed(1)}%)`
                        }
                        contentStyle={{
                          background: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* TABELA */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Identyfikator</TableHead>
                  <TableHead>Placówka</TableHead>
                  {perAccount && <TableHead className="w-40">Konto</TableHead>}
                  <TableHead className="text-right">Saldo początkowe</TableHead>
                  <TableHead className="text-right">Obroty Wn</TableHead>
                  <TableHead className="text-right">Obroty Ma</TableHead>
                  <TableHead className="text-right">Saldo końcowe</TableHead>
                  <TableHead className="w-20 text-right">Akcje</TableHead>
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
                  const colSpan = perAccount ? 8 : 7;
                  return (
                    <React.Fragment key={group.level}>
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={colSpan} className="font-semibold">
                          {group.label}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((r) => (
                        <TableRow key={`${r.locationId}_${r.accountNumber || ''}`}>
                          <TableCell className="font-mono text-xs">{r.identifier}</TableCell>
                          <TableCell>{r.locationName}</TableCell>
                          {perAccount && (
                            <TableCell className="font-mono text-xs">
                              {r.accountNumber || ''}
                            </TableCell>
                          )}
                          <TableCell className="text-right tabular-nums">
                            {formatPLN(r.opening)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPLN(r.debit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPLN(r.credit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatPLN(r.closing)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDrillRow(r)}
                              title="Pokaż transakcje"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/20">
                        <TableCell
                          colSpan={perAccount ? 3 : 2}
                          className="font-semibold text-right"
                        >
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
                        <TableCell />
                      </TableRow>
                    </React.Fragment>
                  );
                })}

                <TableRow className="border-t-2">
                  <TableCell
                    colSpan={perAccount ? 3 : 2}
                    className="font-bold text-right"
                  >
                    RAZEM (wszystkie placówki)
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatPLN(totals.opening)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatPLN(totals.debit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatPLN(totals.credit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatPLN(totals.closing)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* DIALOG DRILL-DOWN */}
        <Dialog open={!!drillRow} onOpenChange={(v) => !v && setDrillRow(null)}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Transakcje — {drillRow?.locationName}
                {drillRow?.accountNumber ? ` · ${drillRow.accountNumber}` : ` · konto ${accountPrefix}`}
                {' · '}{periodLabel}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-40">Nr dokumentu</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="w-44">Konto pełne</TableHead>
                    <TableHead className="text-right w-32">Wn (PLN)</TableHead>
                    <TableHead className="text-right w-32">Ma (PLN)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillTransactions.map((tx) => {
                    const r = tx.exchange_rate || 1;
                    const ccy = tx.currency || 'PLN';
                    const prefix = accountPrefix.trim();
                    const matchesAccount = (acc?: string | null) => {
                      if (!acc) return false;
                      if (drillRow?.accountNumber) return acc === drillRow.accountNumber;
                      return acc.split('-')[0] === prefix;
                    };
                    const dHit = matchesAccount(tx.debit_account?.number);
                    const cHit = matchesAccount(tx.credit_account?.number);
                    const fullAcc = dHit ? tx.debit_account?.number : tx.credit_account?.number;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">{tx.date}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.document?.document_number || '—'}
                        </TableCell>
                        <TableCell className="text-sm">{tx.description || ''}</TableCell>
                        <TableCell className="font-mono text-xs">{fullAcc || ''}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {dHit ? formatPLN(toPLN(tx.debit_amount, ccy, r)) : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cHit ? formatPLN(toPLN(tx.credit_amount, ccy, r)) : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {drillTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Brak transakcji w wybranym okresie.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="flex-row justify-between items-center sm:justify-between">
              <div className="text-sm space-x-4">
                <span>
                  <strong>Suma Wn:</strong> {formatPLN(drillTotals.debit)}
                </span>
                <span>
                  <strong>Suma Ma:</strong> {formatPLN(drillTotals.credit)}
                </span>
                <span>
                  <strong>Saldo okresu:</strong>{' '}
                  {formatPLN(drillTotals.debit - drillTotals.credit)}
                </span>
              </div>
              {drillRow && (
                <Button variant="outline" onClick={() => openInAccountsModule(drillRow)} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Otwórz w module Konta
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default GlobalAccountTurnovers;