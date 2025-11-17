export interface BudgetPlan {
  id: string;
  location_id: string;
  year: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  forecast_method: 'last_year' | 'avg_3_years' | 'manual';
  additional_expenses: number;
  additional_expenses_description: string | null;
  planned_cost_reduction: number;
  planned_cost_reduction_description: string | null;
  comments: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface BudgetItem {
  id: string;
  budget_plan_id: string;
  account_prefix: string;
  account_name: string;
  account_type: 'income' | 'expense';
  planned_amount: number;
  forecasted_amount: number | null;
  previous_year_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  account_type: 'income' | 'expense';
  sort_order: number;
  created_at: string;
}

export interface BudgetCategoryMapping {
  id: string;
  category_id: string;
  account_prefix: string;
  created_at: string;
}

export interface BudgetFormData {
  year: number;
  location_id: string;
  forecast_method: 'last_year' | 'avg_3_years' | 'manual';
  additional_expenses: number;
  additional_expenses_description: string;
  planned_cost_reduction: number;
  planned_cost_reduction_description: string;
}

export interface BudgetRealization {
  month: number;
  monthName: string;
  budgeted: number;
  actual: number;
  percentage: number;
  status: 'green' | 'orange' | 'red' | 'gray';
  remaining: number;
}
