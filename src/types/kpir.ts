
export interface AccountInfo {
  number: string;
  name: string;
}

export interface KpirTransaction {
  id: string;
  date: string;
  formattedDate?: string;
  document_number?: string;
  description: string;
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  settlement_type: 'Gotówka' | 'Bank' | 'Rozrachunek';
  currency: string;
  exchange_rate?: number;
  location_id?: string;
  debitAccount?: AccountInfo;
  creditAccount?: AccountInfo;
}

export interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

export interface KpirOperationFormData {
  date: string;
  document_number: string;
  description: string;
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  settlement_type: 'Gotówka' | 'Bank' | 'Rozrachunek';
  currency: string;
  exchange_rate?: number;
}

export interface ImportRow {
  date: string;
  description: string;
  amount: number;
  account: string;
}
