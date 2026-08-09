/**
 * Wspólna logika „konta domowe placówki” — jedno miejsce dla raportów, eksportów i PDF.
 *
 * Raport placówki musi obejmować WSZYSTKIE zapisy na jej kontach, także te
 * zaksięgowane przez inną placówkę (np. Prowincja księgująca subwencję na
 * koncie domu 201-2-13-1). Filtrowanie po `transactions.location_id` gubi takie
 * operacje — dlatego filtrujemy po numerach kont placówki (segmenty 2 i 3).
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from './supabasePagination';
import { accountBelongsToLocation } from './locationAccountMatching';

export interface HomeAccounts {
  ids: string[];
  numbers: Set<string>;
  identifier: string | null;
}

const EMPTY: HomeAccounts = { ids: [], numbers: new Set<string>(), identifier: null };

/** Konta należące do placówki o wskazanym `locationId` (ścisłe dopasowanie segmentów). */
export const fetchHomeAccounts = async (locationId?: string | null): Promise<HomeAccounts> => {
  if (!locationId) return EMPTY;
  const { data: loc, error } = await supabase
    .from('locations')
    .select('location_identifier')
    .eq('id', locationId)
    .maybeSingle();
  if (error) throw error;
  const identifier = loc?.location_identifier || null;
  if (!identifier) return EMPTY;

  // Kandydaci po LIKE, potem ścisłe dopasowanie po segmentach (LIKE łapie np.
  // „459-4-2-10” dla identyfikatora „2-10”).
  const accs = await fetchAllRows<{ id: string; number: string }>((from, to) =>
    supabase
      .from('accounts')
      .select('id, number')
      .or(`number.like.%-${identifier},number.like.%-${identifier}-%`)
      .order('number')
      .range(from, to)
  );
  const matches = accs.filter((a) => accountBelongsToLocation(a.number, identifier));
  return {
    ids: matches.map((a) => a.id),
    numbers: new Set(matches.map((a) => a.number)),
    identifier,
  };
};

/**
 * Pobiera wszystkie zapisy, których dowolna strona dotyczy podanych kont.
 * Chunkowanie po 300 ID (limit długości URL) + stabilna paginacja (`date`, `id`).
 */
export const fetchTransactionsForAccounts = async (
  accountIds: string[],
  selectClause: string,
  extraFilter?: (q: any) => any
): Promise<any[]> => {
  if (!accountIds || accountIds.length === 0) return [];
  const CHUNK = 300;
  const chunks: string[][] = [];
  for (let i = 0; i < accountIds.length; i += CHUNK) chunks.push(accountIds.slice(i, i + CHUNK));

  const fetchSide = async (side: 'debit_account_id' | 'credit_account_id') => {
    const all: any[] = [];
    for (const ids of chunks) {
      const part = await fetchAllRows<any>((from, to) => {
        let q: any = supabase.from('transactions').select(selectClause).in(side, ids);
        if (extraFilter) q = extraFilter(q);
        return q
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to);
      });
      all.push(...part);
    }
    return all;
  };

  const [d, c] = await Promise.all([
    fetchSide('debit_account_id'),
    fetchSide('credit_account_id'),
  ]);
  const seen = new Set<string>();
  const out: any[] = [];
  for (const tx of [...d, ...c]) {
    if (!seen.has(tx.id)) {
      seen.add(tx.id);
      out.push(tx);
    }
  }
  return out;
};

/**
 * Zeruje (null) tę stronę zapisu, która dotyczy konta obcej placówki.
 * Dzięki temu wszystkie agregacje typu `if (debit_account) {...}` liczą wyłącznie
 * konta danej placówki, bez zmiany ich logiki.
 */
export const maskForeignSides = <T extends { debit_account?: any; credit_account?: any }>(
  transactions: T[],
  homeNumbers: Set<string>
): T[] => {
  if (!homeNumbers || homeNumbers.size === 0) return transactions;
  return transactions.map((tx) => ({
    ...tx,
    debit_account: tx.debit_account && homeNumbers.has(tx.debit_account.number) ? tx.debit_account : null,
    credit_account: tx.credit_account && homeNumbers.has(tx.credit_account.number) ? tx.credit_account : null,
  }));
};