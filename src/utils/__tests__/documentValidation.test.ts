import { describe, it, expect } from 'vitest';
import {
  validateDocumentTransactions,
  validateTransactionFields,
  countMissingFields,
  PROVINCIAL_FEE_DESC,
} from '../documentValidation';
import { Transaction } from '@/pages/Documents/types';

const row = (over: Partial<Transaction> = {}): Transaction => ({
  description: 'Opis',
  debit_amount: 100,
  credit_amount: 100,
  debit_account_id: 'a1',
  credit_account_id: 'a2',
  amount: 100,
  ...over,
});

describe('documentValidation', () => {
  it('dokument zbilansowany i kompletny nie ma błędów', () => {
    const r = validateDocumentTransactions([row()]);
    expect(r.errors).toHaveLength(0);
    expect(r.isBalanced).toBe(true);
    expect(r.totalDebit).toBe(100);
  });

  it('wykrywa niezbilansowanie', () => {
    const r = validateDocumentTransactions([row({ credit_amount: 90 })]);
    expect(r.isBalanced).toBe(false);
    expect(r.errors.some((e) => e.type === 'unbalanced')).toBe(true);
  });

  it('toleruje różnicę poniżej grosza (błąd zmiennoprzecinkowy)', () => {
    const r = validateDocumentTransactions([row({ credit_amount: 100.0000001 })]);
    expect(r.isBalanced).toBe(true);
    expect(r.errors.some((e) => e.type === 'unbalanced')).toBe(false);
  });

  it('traktuje różnicę 0,01 zł jako niezbilansowanie', () => {
    const r = validateDocumentTransactions([row({ credit_amount: 100.01 })]);
    expect(r.isBalanced).toBe(false);
    expect(r.errors.some((e) => e.type === 'unbalanced')).toBe(true);
  });

  it('wykrywa braki kont i kwot', () => {
    const r = validateDocumentTransactions([
      row({ debit_account_id: '', credit_account_id: '', description: '' }),
    ]);
    const err = r.errors.find((e) => e.type === 'incomplete_transaction');
    expect(err?.missingFields).toMatchObject({
      description: true,
      debit_account_id: true,
      credit_account_id: true,
    });
  });

  it('wiersz rozbity waliduje tylko wypełnioną stronę', () => {
    expect(
      countMissingFields(row({ credit_amount: 0, credit_account_id: '' })),
    ).toBe(0);
  });

  it('obsługuje kwoty ujemne', () => {
    const r = validateDocumentTransactions([row({ debit_amount: -50, credit_amount: -50 })]);
    expect(r.errors).toHaveLength(0);
  });

  it('oznacza brak operacji', () => {
    const r = validateDocumentTransactions([]);
    expect(r.errors.some((e) => e.type === 'no_operations')).toBe(true);
  });

  it('wykrywa osierocony wiersz procentu na prowincję', () => {
    const r = validateDocumentTransactions([row({ description: PROVINCIAL_FEE_DESC })]);
    expect(r.errors.some((e) => e.type === 'orphan_provincial_fee')).toBe(true);
  });

  it('nie zgłasza prowincji gdy istnieje wiersz nadrzędny', () => {
    const r = validateDocumentTransactions([row(), row({ description: PROVINCIAL_FEE_DESC })]);
    expect(r.errors.some((e) => e.type === 'orphan_provincial_fee')).toBe(false);
  });

  it('oznacza zapisy równoległe po mainCount', () => {
    const errs = validateTransactionFields([row({ description: '' }), row({ description: '' })], 1);
    expect(errs[0].isParallel).toBe(false);
    expect(errs[1].isParallel).toBe(true);
  });
});
