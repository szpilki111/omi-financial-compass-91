/**
 * Pobieranie zapisów dla bloku kont (pierwszy segment numeru) — wspólne dla
 * kontroli zgodności obliczeń. Paginacja z deterministycznym sortowaniem
 * (`date`, `id`) oraz chunkowanie listy kont po 500 (URL PostgREST).
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from './supabasePagination';
import { EngineTx } from './turnoverEngine';

const SELECT_FIELDS = `id, date, description, debit_amount, credit_amount, currency, exchange_rate,
  debit_account:accounts!transactions_debit_account_id_fkey(number),
  credit_account:accounts!transactions_credit_account_id_fkey(number)`;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** ID kont należących do bloku (np. „110” → 110, 110-1, 110-2-13-1, …). */
export const fetchAccountIdsForPrefix = async (prefix: string): Promise<string[]> => {
  const [withSegments, exact] = await Promise.all([
    fetchAllRows<{ id: string }>((from, to) =>
      supabase.from('accounts').select('id').like('number', `${prefix}-%`).order('id').range(from, to)
    ),
    fetchAllRows<{ id: string }>((from, to) =>
      supabase.from('accounts').select('id').eq('number', prefix).order('id').range(from, to)
    ),
  ]);
  return Array.from(new Set([...withSegments, ...exact].map((a) => a.id)));
};

/** Zapisy na kontach bloku w zadanym zakresie dat (włącznie). */
export const fetchTransactionsForAccountIds = async (
  accountIds: string[],
  dateFrom: string | null,
  dateTo: string
): Promise<EngineTx[]> => {
  if (accountIds.length === 0) return [];
  const sides: Array<'debit_account_id' | 'credit_account_id'> = [
    'debit_account_id',
    'credit_account_id',
  ];
  const lists = await Promise.all(
    sides.flatMap((side) =>
      chunk(accountIds, 500).map((ids) =>
        fetchAllRows<EngineTx>((from, to) => {
          let q = supabase.from('transactions').select(SELECT_FIELDS).in(side, ids).lte('date', dateTo);
          if (dateFrom) q = q.gte('date', dateFrom);
          return q.order('date', { ascending: true }).order('id', { ascending: true }).range(from, to);
        })
      )
    )
  );
  const map = new Map<string, EngineTx>();
  lists.flat().forEach((t) => map.set(t.id, t));
  return Array.from(map.values());
};
