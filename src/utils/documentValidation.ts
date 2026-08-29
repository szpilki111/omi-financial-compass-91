import { Transaction } from '@/pages/Documents/types';

export interface DocumentValidationError {
  type:
    | 'incomplete_transaction'
    | 'no_operations'
    | 'unbalanced'
    | 'missing_accounts'
    | 'orphan_provincial_fee';
  transactionIndex?: number;
  isParallel?: boolean;
  message?: string;
  missingFields?: {
    description?: boolean;
    debit_amount?: boolean;
    credit_amount?: boolean;
    debit_account_id?: boolean;
    credit_account_id?: boolean;
  };
}

export const PROVINCIAL_FEE_DESC = 'procent na prowincję';

const hasAmount = (v?: number | null) => !!v && v !== 0;

/**
 * Zwraca listę brakujących pól w jednej operacji.
 * Operacje „rozbite" (tylko jedna strona wypełniona) walidujemy wyłącznie
 * po stronie wypełnionej — tak jak w oknie dokumentu.
 */
export const getMissingFields = (transaction: Transaction): DocumentValidationError['missingFields'] => {
  const missingFields: DocumentValidationError['missingFields'] = {};
  const hasDebit = hasAmount(transaction.debit_amount);
  const hasCredit = hasAmount(transaction.credit_amount);
  const isSplitTransaction = (hasDebit && !hasCredit) || (!hasDebit && hasCredit);

  if (!transaction.description || transaction.description.trim() === '') missingFields.description = true;

  if (isSplitTransaction) {
    if (hasDebit && !transaction.debit_account_id) missingFields.debit_account_id = true;
    if (hasCredit && !transaction.credit_account_id) missingFields.credit_account_id = true;
  } else {
    if (!hasDebit) missingFields.debit_amount = true;
    if (!hasCredit) missingFields.credit_amount = true;
    if (!transaction.debit_account_id) missingFields.debit_account_id = true;
    if (!transaction.credit_account_id) missingFields.credit_account_id = true;
  }

  return missingFields;
};

export const countMissingFields = (transaction: Transaction): number =>
  Object.keys(getMissingFields(transaction)).length;

/**
 * Walidacja pól wszystkich operacji dokumentu.
 * `mainCount` = liczba operacji podstawowych (dalsze indeksy = zapisy równoległe).
 */
export const validateTransactionFields = (
  transactions: Transaction[],
  mainCount: number = transactions.length,
): DocumentValidationError[] => {
  const errors: DocumentValidationError[] = [];
  transactions.forEach((transaction, index) => {
    const missingFields = getMissingFields(transaction);
    if (Object.keys(missingFields).length > 0) {
      errors.push({
        type: 'incomplete_transaction',
        transactionIndex: index,
        isParallel: index >= mainCount,
        missingFields,
      });
    }
  });
  return errors;
};

export interface DocumentValidationResult {
  errors: DocumentValidationError[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
  missingFieldsCount: number;
}

/**
 * Pełna walidacja dokumentu: braki pól, bilans Wn/Ma, brak operacji
 * oraz osierocone wiersze „procent na prowincję".
 */
export const validateDocumentTransactions = (
  transactions: Transaction[],
  mainCount: number = transactions.length,
): DocumentValidationResult => {
  const errors: DocumentValidationError[] = validateTransactionFields(transactions, mainCount);

  if (transactions.length === 0) {
    errors.push({ type: 'no_operations', message: 'Dokument nie zawiera żadnych operacji.' });
  }

  const totalDebit = transactions.reduce((sum, t) => sum + Math.abs(t.debit_amount || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + Math.abs(t.credit_amount || 0), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = Math.abs(difference) <= 0.01;

  if (transactions.length > 0 && !isBalanced) {
    errors.push({
      type: 'unbalanced',
      message: `Suma WN (${totalDebit.toFixed(2)}) ≠ Suma MA (${totalCredit.toFixed(2)})`,
    });
  }

  // Osierocone wiersze „procent na prowincję" — brak jakiejkolwiek innej operacji,
  // z której mogłyby wynikać (dokument zawiera wyłącznie wiersze prowincji).
  const feeRows = transactions.filter((t) => (t.description || '').trim() === PROVINCIAL_FEE_DESC);
  if (feeRows.length > 0 && feeRows.length === transactions.length) {
    errors.push({
      type: 'orphan_provincial_fee',
      message: 'Dokument zawiera wyłącznie wiersze „procent na prowincję" bez operacji nadrzędnej.',
    });
  }

  const missingFieldsCount = errors.reduce(
    (sum, e) => sum + (e.missingFields ? Object.keys(e.missingFields).length : 0),
    0,
  );

  return { errors, totalDebit, totalCredit, difference, isBalanced, missingFieldsCount };
};

export const describeValidationError = (e: DocumentValidationError): string => {
  if (e.message) return e.message;
  if (e.type === 'incomplete_transaction') {
    const labels: Record<string, string> = {
      description: 'opis',
      debit_amount: 'kwota Wn',
      credit_amount: 'kwota Ma',
      debit_account_id: 'konto Wn',
      credit_account_id: 'konto Ma',
    };
    const fields = Object.keys(e.missingFields || {}).map((k) => labels[k] || k);
    const lp = (e.transactionIndex ?? 0) + 1;
    return `Lp. ${lp}${e.isParallel ? ' (równoległe)' : ''}: brak ${fields.join(', ')}`;
  }
  return e.type;
};
