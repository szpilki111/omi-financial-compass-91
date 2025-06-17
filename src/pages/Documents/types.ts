
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
  currency?: string;
  isCloned?: boolean;
  clonedType?: 'debit' | 'credit';
  debitAccountNumber?: string;
  creditAccountNumber?: string;
  // Add the missing properties that DocumentTable expects
  debitAccount?: {
    number: string;
    name: string;
  };
  creditAccount?: {
    number: string;
    name: string;
  };
}
