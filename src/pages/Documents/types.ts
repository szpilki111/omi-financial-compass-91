
export interface Transaction {
  id?: string;
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  /** Usunięto opis z formularza, więc pole jest opcjonalne */
  description?: string;
  /** Usunięto formę rozrachunku z formularza, więc pole jest opcjonalne */
  settlement_type?: string;
  debit_amount?: number;
  credit_amount?: number;
  isCloned?: boolean;
  clonedType?: 'debit' | 'credit';
  debitAccountNumber?: string;
  creditAccountNumber?: string;
}
