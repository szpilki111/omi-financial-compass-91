
export interface Report {
  id: string;
  title: string;
  period: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  location_id: string;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
  report_type: 'standard';
}

export interface ReportFormData {
  month: number;
  year: number;
  location_id: string;
  report_type: 'standard';
}

export interface ReportSection {
  id: string;
  name: string;
  report_type: 'standard';
  section_order: number;
}

export interface ReportEntry {
  id: string;
  report_id: string;
  section_id: string | null;
  account_number: string;
  account_name: string;
  debit_opening: number | null;
  credit_opening: number | null;
  debit_turnover: number | null;
  credit_turnover: number | null;
  debit_closing: number | null;
  credit_closing: number | null;
}

export interface SectionWithEntries {
  section: ReportSection;
  entries: ReportEntry[];
}

export interface BudgetPlan {
  id: string;
  location_id: string;
  category_id: string;
  year: number;
  month: number;
  planned_amount: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  account_type: 'income' | 'expense';
  created_at: string;
  updated_at: string;
}

export interface ReportDetails {
  id: string;
  report_id: string;
  income_total: number;
  expense_total: number;
  balance: number;
  settlements_total: number;
  created_at: string;
  updated_at: string;
}

// Tymczasowy interfejs dla operacji na tabeli report_details, dopóki typy Supabase nie zostaną zaktualizowane
export interface ReportDetailsRow {
  id: string;
  report_id: string;
  income_total: number;
  expense_total: number;
  balance: number;
  settlements_total: number;
  created_at: string;
  updated_at: string;
}

// Typ dla operacji insert na tabeli report_details
export interface ReportDetailsInsert {
  report_id: string;
  income_total?: number;
  expense_total?: number;
  balance?: number;
  settlements_total?: number;
}

// Typ dla operacji update na tabeli report_details
export interface ReportDetailsUpdate {
  report_id?: string;
  income_total?: number;
  expense_total?: number;
  balance?: number;
  settlements_total?: number;
  updated_at?: string;
}
