import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';
import { Transaction } from '@/pages/Documents/types';

export interface ProvincialFeeConfig {
  fee_percentage: number;
  target_debit_account_prefix: string | null;
  target_credit_account_prefix: string | null;
}

/**
 * Hook centralny do logiki opłaty prowincjalnej.
 * Pobiera ustawienia i prefiksy wyzwalające, udostępnia funkcje:
 * - shouldCreateProvincialFee(transaction)
 * - createProvincialFeeTransaction(baseTransaction, baseIndex)
 * - generateProvincialFees(transactionsList) — dla importerów (dodaje opłaty inline)
 */
export const useProvincialFee = () => {
  const { data: accounts } = useFilteredAccounts();

  const { data: settings } = useQuery({
    queryKey: ['provincialFeeSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ProvincialFeeConfig | null;
    },
  });

  const { data: triggerPrefixes } = useQuery({
    queryKey: ['provincialFeeAccounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_accounts')
        .select('account_number_prefix');
      if (error) throw error;
      return data?.map((a: any) => a.account_number_prefix as string) || [];
    },
  });

  const isConfigured = Boolean(
    settings &&
    triggerPrefixes &&
    triggerPrefixes.length > 0 &&
    settings.fee_percentage > 0 &&
    settings.target_debit_account_prefix &&
    settings.target_credit_account_prefix
  );

  /** Get the base prefix (first segment before dash) from an account ID */
  const getAccountPrefix = (accountId: string): string => {
    if (!accountId) return '';
    const account = accounts?.find((a) => a.id === accountId);
    if (!account) return '';
    return account.number.split('-')[0];
  };

  /** Get the base prefix from an account number string */
  const getAccountPrefixFromNumber = (accountNumber: string): string => {
    if (!accountNumber) return '';
    return accountNumber.split('-')[0];
  };

  /** Resolve a prefix to an account UUID for the current user's location */
  const resolveAccountByPrefix = (prefix: string): string | null => {
    if (!prefix || !accounts) return null;
    const match = accounts.find((a) => a.number.split('-')[0] === prefix);
    return match?.id || null;
  };

  /** Check if a transaction should trigger a provincial fee (by account IDs) */
  const shouldCreateProvincialFee = (transaction: Transaction): boolean => {
    if (!isConfigured) return false;

    const debitPrefix = getAccountPrefix(transaction.debit_account_id);
    const creditPrefix = getAccountPrefix(transaction.credit_account_id);

    return (
      triggerPrefixes!.includes(debitPrefix) ||
      triggerPrefixes!.includes(creditPrefix)
    );
  };

  /** Check if account IDs (UUIDs) trigger provincial fee — for importers that already resolved accounts */
  const shouldCreateProvincialFeeByIds = (
    debitAccountId: string | null,
    creditAccountId: string | null
  ): boolean => {
    if (!isConfigured) return false;
    if (!debitAccountId && !creditAccountId) return false;

    const debitPrefix = debitAccountId ? getAccountPrefix(debitAccountId) : '';
    const creditPrefix = creditAccountId ? getAccountPrefix(creditAccountId) : '';

    return (
      (debitPrefix !== '' && triggerPrefixes!.includes(debitPrefix)) ||
      (creditPrefix !== '' && triggerPrefixes!.includes(creditPrefix))
    );
  };

  /** Create the provincial fee Transaction object (for DocumentDialog UI state) */
  const createProvincialFeeTransaction = (
    baseTransaction: Transaction,
    baseIndex: number
  ): Transaction => {
    const amount = Math.max(baseTransaction.debit_amount || 0, baseTransaction.credit_amount || 0);
    const feeAmount = Math.round(amount * (settings!.fee_percentage / 100) * 100) / 100;

    const debitAccountId = resolveAccountByPrefix(settings!.target_debit_account_prefix!) || '';
    const creditAccountId = resolveAccountByPrefix(settings!.target_credit_account_prefix!) || '';

    return {
      description: 'procent na prowincję',
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      debit_amount: feeAmount,
      credit_amount: feeAmount,
      amount: feeAmount,
      currency: baseTransaction.currency,
      is_provincial_fee: true,
      linked_provincial_fee_index: baseIndex,
      display_order: baseIndex + 2,
    };
  };

  /**
   * For importers: given an array of DB-ready transaction objects,
   * return a new array with provincial fee transactions injected after triggers.
   * Each input object must have debit_account_id, credit_account_id, amount/debit_amount/credit_amount.
   */
  const generateProvincialFeesForImport = <T extends {
    debit_account_id: string | null;
    credit_account_id: string | null;
    debit_amount?: number | null;
    credit_amount?: number | null;
    amount?: number | null;
    description?: string;
    display_order?: number;
    [key: string]: any;
  }>(
    transactionsToImport: T[],
    baseFields: Omit<T, 'debit_account_id' | 'credit_account_id' | 'debit_amount' | 'credit_amount' | 'amount' | 'description' | 'display_order'>
  ): T[] => {
    if (!isConfigured) return transactionsToImport;

    const result: T[] = [];
    let displayOrderCounter = 0;

    for (const tx of transactionsToImport) {
      // Update display_order for consistent ordering
      const txWithOrder = { ...tx, display_order: displayOrderCounter++ };
      result.push(txWithOrder);

      if (shouldCreateProvincialFeeByIds(tx.debit_account_id, tx.credit_account_id)) {
        const baseAmount = Math.max(
          Math.abs(tx.debit_amount || 0),
          Math.abs(tx.credit_amount || 0),
          Math.abs(tx.amount || 0)
        );
        const feeAmount = Math.round(baseAmount * (settings!.fee_percentage / 100) * 100) / 100;

        if (feeAmount > 0) {
          const debitAccountId = resolveAccountByPrefix(settings!.target_debit_account_prefix!);
          const creditAccountId = resolveAccountByPrefix(settings!.target_credit_account_prefix!);

          const feeTx = {
            ...baseFields,
            debit_account_id: debitAccountId,
            credit_account_id: creditAccountId,
            debit_amount: feeAmount,
            credit_amount: feeAmount,
            amount: feeAmount,
            description: 'procent na prowincję',
            display_order: displayOrderCounter++,
          } as T;

          result.push(feeTx);
        }
      }
    }

    return result;
  };

  return {
    settings,
    triggerPrefixes,
    isConfigured,
    getAccountPrefix,
    getAccountPrefixFromNumber,
    resolveAccountByPrefix,
    shouldCreateProvincialFee,
    shouldCreateProvincialFeeByIds,
    createProvincialFeeTransaction,
    generateProvincialFeesForImport,
  };
};
