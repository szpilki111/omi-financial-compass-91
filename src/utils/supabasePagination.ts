/**
 * Helper do pobierania WSZYSTKICH wierszy z Supabase z obejściem
 * domyślnego limitu 1000 wierszy na zapytanie.
 *
 * Użycie:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from('transactions').select('...').eq(...).range(from, to)
 *   );
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Bezpiecznik – maksymalnie 200 stron (200k wierszy) by uniknąć nieskończonej pętli
  for (let page = 0; page < 200; page++) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const chunk = (data || []) as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
