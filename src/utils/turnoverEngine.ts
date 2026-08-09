/**
 * Czysta (bez Supabase) logika liczenia obrotów i sald — wspólna dla widoku
 * „Obroty i salda – globalnie” oraz kontroli zgodności. Dzięki temu wyliczenia
 * są testowalne i identyczne we wszystkich miejscach programu.
 */

import {
  LocationLike,
  UNASSIGNED_LOCATION,
  accountPrefixOf,
  getLocationLevel,
  resolveLocationIdForAccount,
} from './locationAccountMatching';

export interface EngineTx {
  id: string;
  date: string;
  currency?: string | null;
  exchange_rate?: number | null;
  debit_amount?: number | null;
  credit_amount?: number | null;
  debit_account?: { number: string } | null;
  credit_account?: { number: string } | null;
}

export interface TurnoverRow {
  locationId: string;
  locationName: string;
  identifier: string;
  level: number;
  accountNumber?: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

/** Przelicza kwotę na PLN. Brak/zerowy kurs przy walucie obcej = kwota bez przeliczenia. */
export const toPLN = (
  amount?: number | null,
  currency?: string | null,
  rate?: number | null
): number => {
  const a = amount || 0;
  if (!currency || currency === 'PLN') return a;
  if (!rate || rate <= 0) return a;
  return a * rate;
};

/** Sumuje pojedynczą stronę zapisu dla kont o wskazanym prefiksie. */
const sideAmountPLN = (tx: EngineTx, side: 'debit' | 'credit'): number =>
  toPLN(side === 'debit' ? tx.debit_amount : tx.credit_amount, tx.currency, tx.exchange_rate);

export interface AggregateParams {
  prefix: string;
  prevTx: EngineTx[];
  curTx: EngineTx[];
  locations: LocationLike[];
  perAccount?: boolean;
  /** Odfiltrowanie wierszy zerowych (domyślnie true). */
  dropEmpty?: boolean;
}

/**
 * Agregacja obrotów i sald wg placówki (i opcjonalnie pełnego numeru konta).
 * `prevTx` = zapisy do dnia poprzedzającego okres (saldo początkowe),
 * `curTx`  = zapisy z okresu.
 */
export const aggregateTurnovers = ({
  prefix,
  prevTx,
  curTx,
  locations,
  perAccount = false,
  dropEmpty = true,
}: AggregateParams): TurnoverRow[] => {
  const opening = new Map<string, number>();
  const debit = new Map<string, number>();
  const credit = new Map<string, number>();
  const accountFor = new Map<string, string>();
  const locFor = new Map<string, string>();

  const keyFor = (locId: string, accNumber?: string | null) =>
    perAccount && accNumber ? `${locId}__${accNumber}` : locId;

  const apply = (
    tx: EngineTx,
    target: Map<string, number>,
    side: 'debit' | 'credit',
    sign: 1 | -1
  ) => {
    const accNumber = side === 'debit' ? tx.debit_account?.number : tx.credit_account?.number;
    if (!accNumber || accountPrefixOf(accNumber) !== prefix) return;
    const locId = resolveLocationIdForAccount(accNumber, locations) || UNASSIGNED_LOCATION;
    const key = keyFor(locId, accNumber);
    target.set(key, (target.get(key) || 0) + sign * sideAmountPLN(tx, side));
    if (!locFor.has(key)) locFor.set(key, locId);
    if (perAccount) accountFor.set(key, accNumber);
  };

  prevTx.forEach((tx) => {
    apply(tx, opening, 'debit', 1);
    apply(tx, opening, 'credit', -1);
  });
  curTx.forEach((tx) => {
    apply(tx, debit, 'debit', 1);
    apply(tx, credit, 'credit', 1);
  });

  const locById = new Map(locations.map((l) => [l.id, l]));
  const keys = new Set<string>([...opening.keys(), ...debit.keys(), ...credit.keys()]);

  const rows: TurnoverRow[] = Array.from(keys).map((key) => {
    const locId = locFor.get(key) || key.split('__')[0];
    const loc = locById.get(locId);
    const op = opening.get(key) || 0;
    const d = debit.get(key) || 0;
    const cr = credit.get(key) || 0;
    return {
      locationId: locId,
      locationName: loc?.name || (locId === UNASSIGNED_LOCATION ? '(nieprzypisane)' : '(nieznana)'),
      identifier: loc?.location_identifier || '',
      level: getLocationLevel(loc?.location_identifier || null),
      accountNumber: perAccount ? accountFor.get(key) : undefined,
      opening: op,
      debit: d,
      credit: cr,
      closing: op + d - cr,
    };
  });

  return dropEmpty
    ? rows.filter(
        (r) =>
          Math.abs(r.opening) > 0.005 || Math.abs(r.debit) > 0.005 || Math.abs(r.credit) > 0.005
      )
    : rows;
};

/** Obroty per pełny numer konta — niezależna ścieżka kontrolna (bez placówek). */
export const aggregateByAccount = (
  prefix: string,
  prevTx: EngineTx[],
  curTx: EngineTx[]
): Map<string, { opening: number; debit: number; credit: number; closing: number }> => {
  const out = new Map<string, { opening: number; debit: number; credit: number; closing: number }>();
  const bump = (
    acc: string,
    field: 'opening' | 'debit' | 'credit',
    value: number
  ) => {
    const cur = out.get(acc) || { opening: 0, debit: 0, credit: 0, closing: 0 };
    cur[field] += value;
    cur.closing = cur.opening + cur.debit - cur.credit;
    out.set(acc, cur);
  };
  const walk = (list: EngineTx[], isPrev: boolean) => {
    list.forEach((tx) => {
      (['debit', 'credit'] as const).forEach((side) => {
        const accNumber = side === 'debit' ? tx.debit_account?.number : tx.credit_account?.number;
        if (!accNumber || accountPrefixOf(accNumber) !== prefix) return;
        const amt = sideAmountPLN(tx, side);
        if (isPrev) bump(accNumber, 'opening', side === 'debit' ? amt : -amt);
        else bump(accNumber, side, amt);
      });
    });
  };
  walk(prevTx, true);
  walk(curTx, false);
  return out;
};

/** Zaokrąglenie do groszy — do porównań kontrolnych. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;