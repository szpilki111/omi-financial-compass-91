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
  const { data: accounts, isLoading: accountsLoading } = useFilteredAccounts();

  const { data: settings, isLoading: settingsLoading } = useQuery({
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

  const { data: triggerAccounts, isLoading: prefixesLoading } = useQuery({
    queryKey: ['provincialFeeAccounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_accounts')
        .select('id, account_number_prefix, fee_percentage, target_debit_subaccount, target_credit_subaccount');
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        account_number_prefix: string;
        fee_percentage: number | null;
        target_debit_subaccount: string | null;
        target_credit_subaccount: string | null;
      }>;
    },
  });

  const triggerPrefixes = triggerAccounts?.map((a) => a.account_number_prefix) || [];

  const { data: locationsList, isLoading: locationsLoading } = useQuery({
    queryKey: ['locations-for-provincial-fee'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, location_identifier');
      if (error) throw error;
      return (data || []) as Array<{ id: string; location_identifier: string | null }>;
    },
  });

  const { data: exclusions, isLoading: exclusionsLoading } = useQuery({
    queryKey: ['provincialFeeAccountExclusions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provincial_fee_account_exclusions')
        .select('provincial_fee_account_id, location_id');
      if (error) throw error;
      return (data || []) as Array<{ provincial_fee_account_id: string; location_id: string }>;
    },
  });

  const isConfigured = Boolean(
    settings &&
    triggerAccounts &&
    triggerAccounts.length > 0 &&
    settings.target_debit_account_prefix &&
    settings.target_credit_account_prefix
  );

  // isReady = all data loaded (accounts, settings, triggerPrefixes)
  const isReady = Boolean(
    !accountsLoading &&
    !settingsLoading &&
    !prefixesLoading &&
    !exclusionsLoading &&
    !locationsLoading &&
    accounts &&
    accounts.length > 0 &&
    settings !== undefined &&
    triggerAccounts !== undefined
  );

  /** Get the base prefix (first segment before dash) from an account ID */
  const getAccountPrefix = (accountId: string): string => {
    if (!accountId) return '';
    const account = accounts?.find((a) => a.id === accountId);
    if (!account) {
      if (accounts && accounts.length > 0) {
        console.warn(`[ProvincialFee] Account not found for ID: ${accountId}. Accounts loaded: ${accounts.length}`);
      }
      return '';
    }
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

  /**
   * Resolve target account for a specific location and analytical sub-segment.
   * Tries: `${prefix}-${locationIdentifier}-${sub}`, then `${prefix}-${locationIdentifier}`,
   * and finally falls back to `resolveAccountByPrefix(prefix)`.
   */
  const resolveTargetAccountForLocation = (
    prefix: string,
    locationId: string | null | undefined,
    sub: string | null | undefined
  ): string | null => {
    if (!prefix || !accounts) return null;
    const loc = locationId ? locationsList?.find((l) => l.id === locationId) : null;
    const ident = loc?.location_identifier || null;
    if (ident) {
      if (sub) {
        const fullNumber = `${prefix}-${ident}-${sub}`;
        const exact = accounts.find((a) => a.number === fullNumber);
        if (exact) return exact.id;
        console.warn(`[ProvincialFee] Brak konta analitycznego ${fullNumber}; próbuję ${prefix}-${ident}`);
      }
      const parentNumber = `${prefix}-${ident}`;
      const parent = accounts.find((a) => a.number === parentNumber);
      if (parent) return parent.id;
      console.warn(`[ProvincialFee] Brak konta ${parentNumber}; fallback do ${prefix}`);
    }
    return resolveAccountByPrefix(prefix);
  };

  /** Find a trigger account row matching given prefix */
  const findTriggerAccount = (prefix: string) => {
    if (!prefix || !triggerAccounts) return undefined;
    return triggerAccounts.find((t) => t.account_number_prefix === prefix);
  };

  /** Effective % for a trigger account (per-account override or global fallback) */
  const getEffectivePercentage = (triggerPrefix: string): number => {
    const t = findTriggerAccount(triggerPrefix);
    if (t && t.fee_percentage != null && t.fee_percentage > 0) return Number(t.fee_percentage);
    return Number(settings?.fee_percentage || 0);
  };

  /** Is the location excluded from fee for this trigger prefix? */
  const isLocationExcluded = (triggerPrefix: string, locationId?: string | null): boolean => {
    if (!locationId) return false;
    const t = findTriggerAccount(triggerPrefix);
    if (!t || !exclusions) return false;
    return exclusions.some((e) => e.provincial_fee_account_id === t.id && e.location_id === locationId);
  };

  /**
   * Determine which trigger prefix applies to the operation (and is not excluded for the location).
   * Returns the effective prefix or null if none applies.
   */
  const matchTriggerPrefix = (
    debitAccountId: string | null,
    creditAccountId: string | null,
    locationId?: string | null
  ): string | null => {
    if (!isConfigured || !triggerAccounts) return null;
    const candidates: string[] = [];
    if (debitAccountId) {
      const p = getAccountPrefix(debitAccountId);
      if (p && triggerPrefixes.includes(p)) candidates.push(p);
    }
    if (creditAccountId) {
      const p = getAccountPrefix(creditAccountId);
      if (p && triggerPrefixes.includes(p)) candidates.push(p);
    }
    for (const p of candidates) {
      if (!isLocationExcluded(p, locationId)) return p;
    }
    return null;
  };

  /** Check if a transaction should trigger a provincial fee (by account IDs) */
  const shouldCreateProvincialFee = (transaction: Transaction, locationId?: string | null): boolean => {
    return matchTriggerPrefix(transaction.debit_account_id, transaction.credit_account_id, locationId) !== null;
  };

  /** Check if account IDs (UUIDs) trigger provincial fee — for importers that already resolved accounts */
  const shouldCreateProvincialFeeByIds = (
    debitAccountId: string | null,
    creditAccountId: string | null,
    locationId?: string | null
  ): boolean => {
    return matchTriggerPrefix(debitAccountId, creditAccountId, locationId) !== null;
  };

  /** Create the provincial fee Transaction object (for DocumentDialog UI state) */
  const createProvincialFeeTransaction = (
    baseTransaction: Transaction,
    baseIndex: number,
    locationId?: string | null
  ): Transaction => {
    const amount = Math.max(baseTransaction.debit_amount || 0, baseTransaction.credit_amount || 0);
    const triggerPrefix = matchTriggerPrefix(
      baseTransaction.debit_account_id,
      baseTransaction.credit_account_id,
      locationId
    );
    const pct = triggerPrefix ? getEffectivePercentage(triggerPrefix) : Number(settings?.fee_percentage || 0);
    const feeAmount = Math.round(amount * (pct / 100) * 100) / 100;

    const trigger = triggerPrefix ? findTriggerAccount(triggerPrefix) : undefined;
    const debitAccountId =
      resolveTargetAccountForLocation(
        settings!.target_debit_account_prefix!,
        locationId,
        trigger?.target_debit_subaccount || null
      ) || '';
    const creditAccountId =
      resolveTargetAccountForLocation(
        settings!.target_credit_account_prefix!,
        locationId,
        trigger?.target_credit_subaccount || null
      ) || '';

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
    baseFields: Omit<T, 'debit_account_id' | 'credit_account_id' | 'debit_amount' | 'credit_amount' | 'amount' | 'description' | 'display_order'>,
    locationId?: string | null
  ): T[] => {
    if (!isConfigured) return transactionsToImport;

    const result: T[] = [];
    let displayOrderCounter = 0;

    for (const tx of transactionsToImport) {
      // Update display_order for consistent ordering
      const txWithOrder = { ...tx, display_order: displayOrderCounter++ };
      result.push(txWithOrder);

      const triggerPrefix = matchTriggerPrefix(tx.debit_account_id, tx.credit_account_id, locationId);
      if (triggerPrefix) {
        const baseAmount = Math.max(
          Math.abs(tx.debit_amount || 0),
          Math.abs(tx.credit_amount || 0),
          Math.abs(tx.amount || 0)
        );
        const pct = getEffectivePercentage(triggerPrefix);
        const feeAmount = Math.round(baseAmount * (pct / 100) * 100) / 100;

        if (feeAmount > 0) {
          const trigger = findTriggerAccount(triggerPrefix);
          const debitAccountId = resolveTargetAccountForLocation(
            settings!.target_debit_account_prefix!,
            locationId,
            trigger?.target_debit_subaccount || null
          );
          const creditAccountId = resolveTargetAccountForLocation(
            settings!.target_credit_account_prefix!,
            locationId,
            trigger?.target_credit_subaccount || null
          );

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
    triggerAccounts,
    exclusions,
    isConfigured,
    isReady,
    getAccountPrefix,
    getAccountPrefixFromNumber,
    resolveAccountByPrefix,
    resolveTargetAccountForLocation,
    getEffectivePercentage,
    isLocationExcluded,
    matchTriggerPrefix,
    shouldCreateProvincialFee,
    shouldCreateProvincialFeeByIds,
    createProvincialFeeTransaction,
    generateProvincialFeesForImport,
  };
};
