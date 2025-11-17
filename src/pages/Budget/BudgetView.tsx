import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Check, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import BudgetItemsTable from './BudgetItemsTable';
import BudgetRealizationBar from './BudgetRealizationBar';

interface BudgetViewProps {
  budgetId: string;
  onEdit: (budgetId: string) => void;
  onBack: () => void;
}

const BudgetView = ({ budgetId, onEdit, onBack }: BudgetViewProps) => {
  const { user } = useAuth();

  const { data: budget, isLoading, refetch } = useQuery({
    queryKey: ['budget-view', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_plans')
        .select(`
          *,
          locations(name),
          budget_items(*),
          created_by_profile:profiles!budget_plans_created_by_fkey(name),
          submitted_by_profile:profiles!budget_plans_submitted_by_fkey(name),
          approved_by_profile:profiles!budget_plans_approved_by_fkey(name)
        `)
        .eq('id', budgetId)
        .single();

      if (error) throw error;
      return data as any;
    },
  });

  const handleApprove = async () => {
    const { error } = await supabase
      .from('budget_plans')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      })
      .eq('id', budgetId);

    if (error) {
      toast.error('Błąd zatwierdzania budżetu');
      console.error(error);
      return;
    }

    toast.success('Budżet zatwierdzony');
    refetch();
  };

  const handleReject = async () => {
    const reason = prompt('Podaj powód odrzucenia:');
    if (!reason) return;

    const { error } = await supabase
      .from('budget_plans')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', budgetId);

    if (error) {
      toast.error('Błąd odrzucania budżetu');
      console.error(error);
      return;
    }

    toast.success('Budżet odrzucony');
    refetch();
  };

  if (isLoading || !budget) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  const incomeItems = budget.budget_items
    .filter((item: any) => item.account_type === 'income')
    .map((item: any) => ({
      account_prefix: item.account_prefix,
      account_name: item.account_name,
      forecasted: item.forecasted_amount || 0,
      planned: item.planned_amount,
      previous: item.previous_year_amount || 0,
    }));

  const expenseItems = budget.budget_items
    .filter((item: any) => item.account_type === 'expense')
    .map((item: any) => ({
      account_prefix: item.account_prefix,
      account_name: item.account_name,
      forecasted: item.forecasted_amount || 0,
      planned: item.planned_amount,
      previous: item.previous_year_amount || 0,
    }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Projekt</Badge>;
      case 'submitted':
        return <Badge variant="secondary">Złożony</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">Zatwierdzony</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Odrzucony</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Budżet {budget.year}</CardTitle>
              <CardDescription>
                {(budget.locations as any)?.name || 'Nieznana lokalizacja'}
              </CardDescription>
            </div>
            {getStatusBadge(budget.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Metoda prognozowania</div>
              <div className="font-medium">
                {budget.forecast_method === 'last_year' && 'Ostatni rok'}
                {budget.forecast_method === 'avg_3_years' && 'Średnia z 3 lat'}
                {budget.forecast_method === 'manual' && 'Ręcznie'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Utworzony przez</div>
              <div className="font-medium">{budget.created_by_profile?.name || 'Nieznany'}</div>
            </div>
          </div>

          {budget.additional_expenses > 0 && (
            <div>
              <div className="text-sm text-muted-foreground">Prognozowane inne wydatki</div>
              <div className="font-medium">{budget.additional_expenses} zł</div>
              {budget.additional_expenses_description && (
                <div className="text-sm mt-1">{budget.additional_expenses_description}</div>
              )}
            </div>
          )}

          {budget.planned_cost_reduction > 0 && (
            <div>
              <div className="text-sm text-muted-foreground">Planowana redukcja kosztów</div>
              <div className="font-medium">{budget.planned_cost_reduction} zł</div>
              {budget.planned_cost_reduction_description && (
                <div className="text-sm mt-1">{budget.planned_cost_reduction_description}</div>
              )}
            </div>
          )}

          {budget.rejection_reason && (
            <div className="p-4 bg-destructive/10 rounded-md">
              <div className="text-sm font-medium text-destructive">Powód odrzucenia:</div>
              <div className="text-sm mt-1">{budget.rejection_reason}</div>
            </div>
          )}

          <div className="flex gap-2">
            {budget.status === 'draft' && (
              <Button onClick={() => onEdit(budgetId)} variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edytuj
              </Button>
            )}
            {budget.status === 'submitted' && (user?.role === 'admin' || user?.role === 'prowincjal') && (
              <>
                <Button onClick={handleApprove}>
                  <Check className="mr-2 h-4 w-4" />
                  Zatwierdź
                </Button>
                <Button onClick={handleReject} variant="destructive">
                  <X className="mr-2 h-4 w-4" />
                  Odrzuć
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {budget.status === 'approved' && (
        <BudgetRealizationBar
          locationId={budget.location_id}
          year={budget.year}
          budgetItems={budget.budget_items}
        />
      )}

      <BudgetItemsTable
        incomeItems={incomeItems}
        expenseItems={expenseItems}
        onUpdateIncome={() => {}}
        onUpdateExpenses={() => {}}
        readonly
      />
    </div>
  );
};

export default BudgetView;
