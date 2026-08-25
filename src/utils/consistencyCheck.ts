/**
 * Czysta logika kontroli zgodności obliczeń (bez Supabase).
 *
 * Porównuje dwie niezależne ścieżki liczenia tych samych danych:
 *  1. agregację wg placówki (`aggregateTurnovers` – używa widok globalny),
 *  2. agregację wg pełnego numeru konta (`aggregateByAccount` – ścieżka
 *     odpowiadająca modułowi „Wyszukaj konta”), grupowaną potem po placówce.
 *
 * Jeżeli obie ścieżki dają ten sam wynik, wyliczenia w programie są spójne.
 */

import {
  LocationLike,
  UNASSIGNED_LOCATION,
  resolveLocationIdForAccount,
} from './locationAccountMatching';
import {
  EngineTx,
  aggregateByAccount,
  aggregateTurnovers,
  round2,
} from './turnoverEngine';

/** Domyślna tolerancja porównań – jeden grosz. */
export const TOLERANCE = 0.01;

export type DiffField = 'opening' | 'debit' | 'credit' | 'closing';

export interface Discrepancy {
  prefix: string;
  month: number;
  locationId: string;
  locationName: string;
  field: DiffField;
  /** Wynik agregacji wg placówki (widok globalny). */
  byLocation: number;
  /** Wynik agregacji wg pełnych numerów kont („Wyszukaj konta”). */
  byAccount: number;
  difference: number;
}

export interface CheckParams {
  prefix: string;
  month: number;
  locations: LocationLike[];
  /** Zapisy do dnia poprzedzającego okres (saldo początkowe). */
  prevTx: EngineTx[];
  /** Zapisy z okresu. */
  curTx: EngineTx[];
  tolerance?: number;
}

interface Bucket {
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

const emptyBucket = (): Bucket => ({ opening: 0, debit: 0, credit: 0, closing: 0 });

/** Grupuje wynik `aggregateByAccount` po placówce wynikającej z numeru konta. */
export const groupAccountTotalsByLocation = (
  prefix: string,
  prevTx: EngineTx[],
  curTx: EngineTx[],
  locations: LocationLike[]
): Map<string, Bucket> => {
  const perAccount = aggregateByAccount(prefix, prevTx, curTx);
  const out = new Map<string, Bucket>();
  perAccount.forEach((v, accountNumber) => {
    const locId = resolveLocationIdForAccount(accountNumber, locations) || UNASSIGNED_LOCATION;
    const cur = out.get(locId) || emptyBucket();
    cur.opening += v.opening;
    cur.debit += v.debit;
    cur.credit += v.credit;
    cur.closing = cur.opening + cur.debit - cur.credit;
    out.set(locId, cur);
  });
  return out;
};

/**
 * Porównanie obu ścieżek dla jednego bloku kont i jednego okresu.
 * Pusta tablica = pełna zgodność.
 */
export const findDiscrepancies = ({
  prefix,
  month,
  locations,
  prevTx,
  curTx,
  tolerance = TOLERANCE,
}: CheckParams): Discrepancy[] => {
  const byLocationRows = aggregateTurnovers({
    prefix,
    prevTx,
    curTx,
    locations,
    dropEmpty: false,
  });
  const byLocation = new Map<string, Bucket>();
  const nameFor = new Map<string, string>();
  byLocationRows.forEach((r) => {
    byLocation.set(r.locationId, {
      opening: r.opening,
      debit: r.debit,
      credit: r.credit,
      closing: r.closing,
    });
    nameFor.set(r.locationId, r.locationName);
  });

  const byAccount = groupAccountTotalsByLocation(prefix, prevTx, curTx, locations);

  const keys = new Set<string>([...byLocation.keys(), ...byAccount.keys()]);
  const fields: DiffField[] = ['opening', 'debit', 'credit', 'closing'];
  const out: Discrepancy[] = [];

  keys.forEach((locId) => {
    const a = byLocation.get(locId) || emptyBucket();
    const b = byAccount.get(locId) || emptyBucket();
    fields.forEach((field) => {
      const diff = round2(a[field] - b[field]);
      if (Math.abs(diff) >= tolerance) {
        out.push({
          prefix,
          month,
          locationId: locId,
          locationName:
            nameFor.get(locId) ||
            locations.find((l) => l.id === locId)?.name ||
            (locId === UNASSIGNED_LOCATION ? '(nieprzypisane)' : '(nieznana)'),
          field,
          byLocation: round2(a[field]),
          byAccount: round2(b[field]),
          difference: diff,
        });
      }
    });
  });

  return out;
};

/**
 * Kontrola „suma wierszy = RAZEM”: sprawdza, czy suma wierszy tabeli zgadza się
 * z sumą liczoną niezależnie po numerach kont.
 */
export const checkRowsSumEqualsTotal = ({
  prefix,
  month,
  locations,
  prevTx,
  curTx,
  tolerance = TOLERANCE,
}: CheckParams): Discrepancy[] => {
  const rows = aggregateTurnovers({ prefix, prevTx, curTx, locations, dropEmpty: false });
  const total = rows.reduce<Bucket>(
    (acc, r) => ({
      opening: acc.opening + r.opening,
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      closing: acc.closing + r.closing,
    }),
    emptyBucket()
  );

  const perAccount = aggregateByAccount(prefix, prevTx, curTx);
  const grand = emptyBucket();
  perAccount.forEach((v) => {
    grand.opening += v.opening;
    grand.debit += v.debit;
    grand.credit += v.credit;
  });
  grand.closing = grand.opening + grand.debit - grand.credit;

  const fields: DiffField[] = ['opening', 'debit', 'credit', 'closing'];
  return fields
    .map((field) => ({
      prefix,
      month,
      locationId: '__total__',
      locationName: 'RAZEM',
      field,
      byLocation: round2(total[field]),
      byAccount: round2(grand[field]),
      difference: round2(total[field] - grand[field]),
    }))
    .filter((d) => Math.abs(d.difference) >= tolerance);
};

/** Porównanie dowolnych dwóch kwot (np. raport miesięczny vs obroty). */
export const amountsMatch = (a: number, b: number, tolerance = TOLERANCE): boolean =>
  Math.abs(round2(a - b)) < tolerance;
