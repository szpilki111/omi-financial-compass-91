
export interface Transaction {
  id?: string;
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  description: string;
  settlement_type: string;
  debit_amount?: number;
  credit_amount?: number;
  isCloned?: boolean;
  clonedType?: 'debit' | 'credit';
  debitAccountNumber?: string;
  creditAccountNumber?: string;
}
