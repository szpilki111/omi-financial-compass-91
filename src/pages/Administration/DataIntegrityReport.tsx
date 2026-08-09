import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/Spinner';
import { fetchAllRows } from '@/utils/supabasePagination';
import {
  LocationLike,
  resolveLocationIdentifierForAccount,
} from '@/utils/locationAccountMatching';

interface AccountRow {
  id: string;
  number: string;
  name: string;
}

interface OrphanTx {
  id: string;
  date: string;
  description: string | null;
  document_number: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
}

/**
 * Raport techniczny spójności danych: konta o segmentach placówki, które nie
 * odpowiadają żadnej placówce (wpadają do wiersza „(nieprzypisane)” w obrotach
 * globalnych) oraz zapisy bez konta Wn i Ma (rozbilansowują dokument).
 */
const DataIntegrityReport: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['data-integrity-report'],
    queryFn: async () => {
      const [locRes, accounts, orphans] = await Promise.all([
        supabase.from('locations').select('id, name, location_identifier'),
        fetchAllRows<AccountRow>((from, to) =>
          supabase.from('accounts').select('id, number, name').order('number').range(from, to)
        ),
        fetchAllRows<OrphanTx>((from, to) =>
          supabase
            .from('transactions')
            .select('id, date, description, document_number, debit_amount, credit_amount')
            .is('debit_account_id', null)
            .is('credit_account_id', null)
            .order('date', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to)
        ),
      ]);
      if (locRes.error) throw locRes.error;
      const locations = (locRes.data || []) as LocationLike[];

      const unassigned = accounts.filter(
        (a) =>
          a.number.includes('-') && !resolveLocationIdentifierForAccount(a.number, locations)
      );

      // Które z nieprzypisanych kont mają zapisy (to są przypadki pilne)
      const withTx = new Set<string>();
      const ids = unassigned.map((a) => a.id);
      for (let i = 0; i < ids.length; i += 300) {
        const chunk = ids.slice(i, i + 300);
        const [d, c] = await Promise.all([
          supabase.from('transactions').select('debit_account_id').in('debit_account_id', chunk),
          supabase.from('transactions').select('credit_account_id').in('credit_account_id', chunk),
        ]);
        (d.data || []).forEach((r: any) => withTx.add(r.debit_account_id));
        (c.data || []).forEach((r: any) => withTx.add(r.credit_account_id));
      }

      return { unassigned, withTx, orphans };
    },
  });

  const unassignedSorted = useMemo(
    () =>
      (data?.unassigned || []).slice().sort((a, b) => {
        const aTx = data?.withTx.has(a.id) ? 0 : 1;
        const bTx = data?.withTx.has(b.id) ? 0 : 1;
        if (aTx !== bTx) return aTx - bTx;
        return a.number.localeCompare(b.number, 'pl', { numeric: true });
      }),
    [data]
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6">
        <Spinner /> Wczytywanie raportu spójności…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Konta bez przypisanej placówki ({unassignedSorted.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Segmenty numeru konta (2 i 3) nie odpowiadają identyfikatorowi żadnej placówki.
            Zapisy na takich kontach trafiają w obrotach globalnych do wiersza „(nieprzypisane)”.
            Konta z zapisami są na początku listy — te wymagają poprawy w pierwszej kolejności.
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Zapisy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedSorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>Brak — wszystkie konta mają placówkę.</TableCell>
                  </TableRow>
                )}
                {unassignedSorted.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.number}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>
                      {data?.withTx.has(a.id) ? (
                        <span className="text-destructive font-medium">są zapisy</span>
                      ) : (
                        <span className="text-muted-foreground">brak</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zapisy bez konta Wn i Ma ({data?.orphans.length || 0})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Wiersze operacji, w których nie wskazano żadnego konta. Nie wchodzą do obrotów,
            ale rozbilansowują dokument i świecą się na czerwono na liście dokumentów.
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="text-right">Wn</TableHead>
                  <TableHead className="text-right">Ma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.orphans.length || 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>Brak osieroconych zapisów.</TableCell>
                  </TableRow>
                )}
                {(data?.orphans || []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.date}</TableCell>
                    <TableCell className="font-mono">{t.document_number || '—'}</TableCell>
                    <TableCell>{t.description || '—'}</TableCell>
                    <TableCell className="text-right">{t.debit_amount ?? '—'}</TableCell>
                    <TableCell className="text-right">{t.credit_amount ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataIntegrityReport;