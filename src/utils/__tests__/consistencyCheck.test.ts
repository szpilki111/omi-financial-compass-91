import { describe, expect, it } from 'vitest';
import {
  checkRowsSumEqualsTotal,
  findDiscrepancies,
  groupAccountTotalsByLocation,
  amountsMatch,
} from '../consistencyCheck';
import { EngineTx } from '../turnoverEngine';
import { LocationLike } from '../locationAccountMatching';

const locations: LocationLike[] = [
  { id: 'prov', name: 'Prowincja', location_identifier: '1' },
  { id: 'dom', name: 'Dom 2-13', location_identifier: '2-13' },
  { id: 'par', name: 'Parafia 3-7', location_identifier: '3-7' },
  { id: 'spolka', name: 'Spółka 5-1', location_identifier: '5-1' },
];

const tx = (
  id: string,
  debit?: string,
  credit?: string,
  amount = 100,
  extra: Partial<EngineTx> = {}
): EngineTx => ({
  id,
  date: '2026-01-15',
  debit_amount: debit ? amount : null,
  credit_amount: credit ? amount : null,
  debit_account: debit ? { number: debit } : null,
  credit_account: credit ? { number: credit } : null,
  ...extra,
});

describe('consistencyCheck', () => {
  it('nie wykrywa różnic, gdy obie ścieżki liczą to samo', () => {
    const curTx = [
      tx('1', '210-3-7', '100-1', 1800),
      tx('2', '210-3-7', '100-1', 2850),
      tx('3', '210-3-7', '100-1', 6100),
    ];
    expect(
      findDiscrepancies({ prefix: '210', month: 1, locations, prevTx: [], curTx })
    ).toEqual([]);
    expect(
      checkRowsSumEqualsTotal({ prefix: '210', month: 1, locations, prevTx: [], curTx })
    ).toEqual([]);
  });

  it('grupuje obroty kont analitycznych do jednej placówki', () => {
    const curTx = [
      tx('1', '110-2-13-1', undefined, 500),
      tx('2', '110-2-13-2', undefined, 250),
      tx('3', '110-1', undefined, 999),
    ];
    const grouped = groupAccountTotalsByLocation('110', [], curTx, locations);
    expect(grouped.get('dom')?.debit).toBe(750);
    expect(grouped.get('prov')?.debit).toBe(999);
  });

  it('placówka poziomu 5 nie ginie w kontroli sum', () => {
    const curTx = [tx('1', '100-5-1', undefined, 120)];
    expect(
      checkRowsSumEqualsTotal({ prefix: '100', month: 3, locations, prevTx: [], curTx })
    ).toEqual([]);
    const grouped = groupAccountTotalsByLocation('100', [], curTx, locations);
    expect(grouped.get('spolka')?.debit).toBe(120);
  });

  it('konta bez placówki trafiają do „(nieprzypisane)” w obu ścieżkach', () => {
    const curTx = [tx('1', '100-3-18', undefined, 77)];
    expect(
      findDiscrepancies({ prefix: '100', month: 5, locations, prevTx: [], curTx })
    ).toEqual([]);
    const grouped = groupAccountTotalsByLocation('100', [], curTx, locations);
    expect(grouped.get('__unassigned__')?.debit).toBe(77);
  });

  it('uwzględnia saldo początkowe z okresu poprzedniego', () => {
    const prevTx = [tx('p1', '100-1', undefined, 400), tx('p2', undefined, '100-1', 150)];
    const curTx = [tx('c1', '100-1', undefined, 50)];
    expect(findDiscrepancies({ prefix: '100', month: 2, locations, prevTx, curTx })).toEqual([]);
    const grouped = groupAccountTotalsByLocation('100', prevTx, curTx, locations);
    expect(grouped.get('prov')?.opening).toBe(250);
    expect(grouped.get('prov')?.closing).toBe(300);
  });

  it('waluta obca przeliczana jest jednakowo w obu ścieżkach', () => {
    const curTx = [
      tx('1', '110-1', undefined, 100, { currency: 'EUR', exchange_rate: 4.3 }),
      tx('2', undefined, '110-1', 50, { currency: 'EUR', exchange_rate: 4.3 }),
    ];
    expect(findDiscrepancies({ prefix: '110', month: 7, locations, prevTx: [], curTx })).toEqual([]);
    const grouped = groupAccountTotalsByLocation('110', [], curTx, locations);
    expect(grouped.get('prov')?.debit).toBeCloseTo(430, 2);
    expect(grouped.get('prov')?.credit).toBeCloseTo(215, 2);
  });

  it('amountsMatch toleruje różnice poniżej grosza', () => {
    expect(amountsMatch(100.004, 100)).toBe(true);
    expect(amountsMatch(100.02, 100)).toBe(false);
  });
});
