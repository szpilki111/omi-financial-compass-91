import { describe, it, expect } from 'vitest';
import { LocationLike } from '../locationAccountMatching';
import { EngineTx, aggregateByAccount, aggregateTurnovers, round2, toPLN } from '../turnoverEngine';

const locations: LocationLike[] = [
  { id: 'prow', name: 'Prowincja', location_identifier: '1' },
  { id: 'dom-13', name: 'Dom 2-13', location_identifier: '2-13' },
  { id: 'par-7', name: 'Parafia św. Eugeniusza', location_identifier: '3-7' },
  { id: 'spolka', name: 'NINIWA Sp. z o.o.', location_identifier: '5-1' },
];

let seq = 0;
const tx = (
  debitAcc: string | null,
  creditAcc: string | null,
  amount: number,
  extra: Partial<EngineTx> = {}
): EngineTx => ({
  id: `tx-${++seq}`,
  date: '2026-01-15',
  currency: 'PLN',
  exchange_rate: 1,
  debit_amount: debitAcc ? amount : null,
  credit_amount: creditAcc ? amount : null,
  debit_account: debitAcc ? { number: debitAcc } : null,
  credit_account: creditAcc ? { number: creditAcc } : null,
  ...extra,
});

const rowFor = (rows: ReturnType<typeof aggregateTurnovers>, locationId: string, account?: string) =>
  rows.find((r) => r.locationId === locationId && (!account || r.accountNumber === account));

describe('toPLN', () => {
  it('PLN bez przeliczania', () => {
    expect(toPLN(100, 'PLN', 1)).toBe(100);
    expect(toPLN(100, null, null)).toBe(100);
  });
  it('waluta obca przeliczana kursem', () => {
    expect(toPLN(100, 'EUR', 4.3)).toBeCloseTo(430, 6);
  });
  it('brak kursu lub kurs 0 nie zeruje kwoty', () => {
    expect(toPLN(100, 'EUR', null)).toBe(100);
    expect(toPLN(100, 'EUR', 0)).toBe(100);
    expect(toPLN(100, 'EUR', -2)).toBe(100);
  });
  it('brak kwoty = 0', () => {
    expect(toPLN(null, 'EUR', 4.3)).toBe(0);
    expect(toPLN(undefined, 'PLN', 1)).toBe(0);
  });
});

describe('aggregateTurnovers — przypisanie do placówki po numerze konta', () => {
  it('zapis zaksięgowany przez Prowincję na koncie parafii trafia do parafii (210-3-7, 10 750)', () => {
    const rows = aggregateTurnovers({
      prefix: '210',
      prevTx: [],
      curTx: [
        tx('210-3-7', '100-3-7', 1800),
        tx('210-3-7', '100-1', 2850),
        tx('210-3-7', '100-1', 6100),
      ],
      locations,
    });
    expect(rowFor(rows, 'par-7')!.debit).toBe(10750);
    expect(rowFor(rows, 'prow')).toBeUndefined();
  });

  it('konto Prowincji nie wciąga kont domów', () => {
    const rows = aggregateTurnovers({
      prefix: '100',
      prevTx: [],
      curTx: [tx('100-1', null, 500), tx('100-2-13', null, 700)],
      locations,
    });
    expect(rowFor(rows, 'prow')!.debit).toBe(500);
    expect(rowFor(rows, 'dom-13')!.debit).toBe(700);
  });

  it('konta o nieznanych segmentach trafiają do „(nieprzypisane)”', () => {
    const rows = aggregateTurnovers({
      prefix: '100',
      prevTx: [],
      curTx: [tx('100-3-17', null, 120)],
      locations,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].locationName).toBe('(nieprzypisane)');
    expect(rows[0].level).toBe(0);
  });

  it('spółki (poziom 5) są ujęte z poziomem 5', () => {
    const rows = aggregateTurnovers({
      prefix: '100',
      prevTx: [],
      curTx: [tx('100-5-1', null, 900)],
      locations,
    });
    expect(rows[0].level).toBe(5);
    expect(rows[0].locationId).toBe('spolka');
  });

  it('ignoruje konta o innym prefiksie', () => {
    const rows = aggregateTurnovers({
      prefix: '210',
      prevTx: [],
      curTx: [tx('401-3-7', '702-3-7', 1000)],
      locations,
    });
    expect(rows).toHaveLength(0);
  });

  it('zapis bez kont nie psuje wyniku', () => {
    const rows = aggregateTurnovers({
      prefix: '210',
      prevTx: [],
      curTx: [tx(null, null, 0), tx('210-3-7', null, 100)],
      locations,
    });
    expect(rowFor(rows, 'par-7')!.debit).toBe(100);
    expect(rowFor(rows, 'par-7')!.credit).toBe(0);
  });

  it('to samo konto po Wn i Ma liczone po obu stronach', () => {
    const rows = aggregateTurnovers({
      prefix: '210',
      prevTx: [],
      curTx: [tx('210-3-7', '210-3-7', 300)],
      locations,
    });
    const r = rowFor(rows, 'par-7')!;
    expect(r.debit).toBe(300);
    expect(r.credit).toBe(300);
    expect(r.closing).toBe(0);
  });

  it('kwoty Wn i Ma mogą być różne (zapisy podzielone)', () => {
    const rows = aggregateTurnovers({
      prefix: '210',
      prevTx: [],
      curTx: [
        {
          ...tx('210-3-7', '210-3-7', 0),
          debit_amount: 250,
          credit_amount: 100,
        },
      ],
      locations,
    });
    const r = rowFor(rows, 'par-7')!;
    expect(r.debit).toBe(250);
    expect(r.credit).toBe(100);
  });

  it('saldo początkowe = Wn − Ma z zapisów wcześniejszych', () => {
    const rows = aggregateTurnovers({
      prefix: '110',
      prevTx: [tx('110-2-13', null, 5000), tx(null, '110-2-13', 1200)],
      curTx: [tx('110-2-13', null, 300)],
      locations,
    });
    const r = rowFor(rows, 'dom-13')!;
    expect(r.opening).toBe(3800);
    expect(r.closing).toBe(4100);
  });

  it('saldo początkowe ujemne (zobowiązania) jest zachowane', () => {
    const rows = aggregateTurnovers({
      prefix: '210',
      prevTx: [tx(null, '210-3-7', 41200)],
      curTx: [tx('210-3-7', null, 10750), tx(null, '210-3-7', 11200)],
      locations,
    });
    const r = rowFor(rows, 'par-7')!;
    expect(r.opening).toBe(-41200);
    expect(r.debit).toBe(10750);
    expect(r.credit).toBe(11200);
    expect(r.closing).toBe(-41650);
  });

  it('waluty obce przeliczane na PLN', () => {
    const rows = aggregateTurnovers({
      prefix: '110',
      prevTx: [],
      curTx: [tx('110-2-13', null, 1000, { currency: 'EUR', exchange_rate: 4.25 })],
      locations,
    });
    expect(rowFor(rows, 'dom-13')!.debit).toBeCloseTo(4250, 6);
  });

  it('zaokrąglenia groszowe nie gubią kwot', () => {
    const rows = aggregateTurnovers({
      prefix: '110',
      prevTx: [],
      curTx: [tx('110-2-13', null, 0.1), tx('110-2-13', null, 0.2)],
      locations,
    });
    expect(round2(rowFor(rows, 'dom-13')!.debit)).toBe(0.3);
  });

  it('perAccount rozbija po pełnym numerze konta', () => {
    const rows = aggregateTurnovers({
      prefix: '110',
      prevTx: [],
      curTx: [
        tx('110-2-13-1', null, 100),
        tx('110-2-13-2', null, 200),
        tx('110-2-13-3', null, 300),
      ],
      locations,
      perAccount: true,
    });
    expect(rows).toHaveLength(3);
    expect(rowFor(rows, 'dom-13', '110-2-13-2')!.debit).toBe(200);
    expect(rows.reduce((s, r) => s + r.debit, 0)).toBe(600);
  });

  it('bez perAccount analityki scalają się w syntetykę placówki', () => {
    const rows = aggregateTurnovers({
      prefix: '110',
      prevTx: [],
      curTx: [tx('110-2-13-1', null, 100), tx('110-2-13-2', null, 200)],
      locations,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].debit).toBe(300);
  });

  it('wiersze zerowe są pomijane, chyba że dropEmpty=false', () => {
    const args = {
      prefix: '110',
      prevTx: [],
      curTx: [tx('110-2-13', null, 0)],
      locations,
    };
    expect(aggregateTurnovers(args)).toHaveLength(0);
    expect(aggregateTurnovers({ ...args, dropEmpty: false })).toHaveLength(1);
  });

  it('suma wierszy = suma wszystkich zapisów (kontrola „suma = RAZEM”)', () => {
    const curTx = [
      tx('110-1', null, 100),
      tx('110-2-13', null, 200),
      tx('110-5-1', null, 300),
      tx('110-3-17', null, 400),
    ];
    const rows = aggregateTurnovers({ prefix: '110', prevTx: [], curTx, locations });
    expect(rows.reduce((s, r) => s + r.debit, 0)).toBe(1000);
  });
});

describe('aggregateByAccount — niezależna ścieżka kontrolna', () => {
  it('daje te same sumy co agregacja po placówkach', () => {
    const curTx = [
      tx('210-3-7', null, 1800),
      tx('210-3-7', null, 2850),
      tx('210-3-7', null, 6100),
      tx(null, '210-3-7', 11200),
    ];
    const prevTx = [tx(null, '210-3-7', 41200)];
    const byAcc = aggregateByAccount('210', prevTx, curTx);
    const rows = aggregateTurnovers({ prefix: '210', prevTx, curTx, locations });
    const a = byAcc.get('210-3-7')!;
    const r = rowFor(rows, 'par-7')!;
    expect(a.debit).toBe(r.debit);
    expect(a.credit).toBe(r.credit);
    expect(a.opening).toBe(r.opening);
    expect(a.closing).toBe(r.closing);
  });

  it('rozdziela analityki po pełnym numerze', () => {
    const byAcc = aggregateByAccount('110', [], [tx('110-2-13-1', null, 50), tx('110-2-13-2', null, 70)]);
    expect(byAcc.get('110-2-13-1')!.debit).toBe(50);
    expect(byAcc.get('110-2-13-2')!.debit).toBe(70);
  });
});