
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
  report_type: 'standard' | 'zos' | 'bilans' | 'rzis' | 'jpk' | 'analiza';
}

export interface ReportFormData {
  month: number;
  year: number;
  location_id: string;
  report_type: 'standard' | 'zos' | 'bilans' | 'rzis' | 'jpk' | 'analiza';
}

export interface ReportSection {
  id: string;
  name: string;
  report_type: 'standard' | 'zos' | 'bilans' | 'rzis' | 'jpk' | 'analiza';
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
