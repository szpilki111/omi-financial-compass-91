
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
}

export interface ReportFormData {
  month: number;
  year: number;
  location_id: string;
}
