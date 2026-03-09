import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Check, X, FileText, Download } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { sendBudgetNotification } from '@/utils/budgetNotifications';
import BudgetItemsTable from './BudgetItemsTable';
import BudgetRealizationBar from './BudgetRealizationBar';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getBudgetRealizationForMonthDetailed } from '@/utils/budgetUtils';

interface BudgetViewProps {
  budgetId: string;
  onEdit: (budgetId: string) => void;
  onBack: () => void;
}

const BudgetView = ({ budgetId, onEdit, onBack }: BudgetViewProps) => {
  const { user } = useAuth();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('budget_plans')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', budgetId);

      if (error) {
        console.error('[BUDGET] Error approving budget:', error);
        
        if (error.code === '42501' || error.message?.includes('permission')) {
          toast.error('[BŁĄD UPRAWNIEŃ] Nie masz uprawnień do zatwierdzenia tego budżetu');
        } else {
          toast.error(`[BŁĄD APLIKACJI] Błąd zatwierdzania budżetu: ${error.message}`);
        }
        return;
      }

      // Send approval email
      const { data: creatorData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', budget.created_by)
        .single();

      if (creatorData?.email && budget.locations?.name) {
        await sendBudgetNotification({
          type: 'budget_approved',
          budgetId,
          recipientEmail: creatorData.email,
          budgetYear: budget.year,
          locationName: budget.locations.name,
        });
      }

      toast.success('Budżet zatwierdzony');
      refetch();
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Podaj powód odrzucenia');
      return;
    }

    const reason = rejectionReason.trim();
    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from('budget_plans')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', budgetId);

      if (error) {
        console.error('[BUDGET] Error rejecting budget:', error);
        
        if (error.code === '42501' || error.message?.includes('permission')) {
          toast.error('[BŁĄD UPRAWNIEŃ] Nie masz uprawnień do odrzucenia tego budżetu');
        } else {
          toast.error(`[BŁĄD APLIKACJI] Błąd odrzucania budżetu: ${error.message}`);
        }
        return;
      }

      // Send rejection email
      const { data: creatorData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', budget.created_by)
        .single();

      if (creatorData?.email && budget.locations?.name) {
        await sendBudgetNotification({
          type: 'budget_rejected',
          budgetId,
          recipientEmail: creatorData.email,
          budgetYear: budget.year,
          locationName: budget.locations.name,
          rejectionReason: reason,
        });
      }

      toast.success('Budżet odrzucony');
      setShowRejectDialog(false);
      setRejectionReason('');
      refetch();
    } finally {
      setIsRejecting(false);
    }
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

  // Fetch realization data per account
  const { data: realizationByAccount } = useQuery({
    queryKey: ['budget-realization-by-account', budget?.location_id, budget?.year],
    queryFn: async () => {
      if (!budget) return {};
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const maxMonth = currentYear === budget.year ? currentMonth : 12;
      
      // Fetch all transactions for the year
      const startDate = `${budget.year}-01-01`;
      const endDate = `${budget.year}-${String(maxMonth).padStart(2, '0')}-${new Date(budget.year, maxMonth, 0).getDate()}`;
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('debit_amount, credit_amount, accounts!transactions_debit_account_id_fkey(number), credit_account:accounts!transactions_credit_account_id_fkey(number)')
        .eq('location_id', budget.location_id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (error || !transactions) return {};
      
      const result: Record<string, number> = {};
      
      transactions.forEach((t: any) => {
        // Expenses: 4xx accounts on debit side
        const debitNumber = t.accounts?.number || '';
        if (debitNumber.startsWith('4') && t.debit_amount) {
          const prefix = debitNumber.split('-')[0];
          result[prefix] = (result[prefix] || 0) + t.debit_amount;
        }
        // Also 201 accounts on debit side (Świadczenia na prowincję)
        if (debitNumber.startsWith('201') && t.debit_amount) {
          result['201'] = (result['201'] || 0) + t.debit_amount;
        }
        // Income: 7xx accounts on credit side
        const creditNumber = t.credit_account?.number || '';
        if (creditNumber.startsWith('7') && t.credit_amount) {
          const prefix = creditNumber.split('-')[0];
          result[prefix] = (result[prefix] || 0) + t.credit_amount;
        }
      });
      
      return result;
    },
    enabled: !!budget,
  });

  const incomeItems = budget?.budget_items
    ?.filter((item: any) => item.account_type === 'income')
    .map((item: any) => {
      const basePrefix = item.account_prefix.split('-')[0];
      return {
        account_prefix: item.account_prefix,
        account_name: item.account_name,
        forecasted: item.forecasted_amount || 0,
        planned: item.planned_amount,
        previous: item.previous_year_amount || 0,
        realized: realizationByAccount?.[basePrefix] || 0,
      };
    }) || [];

  const expenseItems = budget?.budget_items
    ?.filter((item: any) => item.account_type === 'expense')
    .map((item: any) => {
      const basePrefix = item.account_prefix.split('-')[0];
      return {
        account_prefix: item.account_prefix,
        account_name: item.account_name,
        forecasted: item.forecasted_amount || 0,
        planned: item.planned_amount,
        previous: item.previous_year_amount || 0,
        realized: realizationByAccount?.[basePrefix] || 0,
      };
    }) || [];

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

          {budget.comments && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Notatki</div>
              <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                {budget.comments}
              </div>
            </div>
          )}

          {budget.attachments && budget.attachments.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Załączniki</div>
              <div className="space-y-2">
                {budget.attachments.map((filePath: string, index: number) => {
                  const fileName = filePath.split('/').pop() || filePath;
                  return (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1">{fileName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const { data } = supabase.storage
                            .from('budget-attachments')
                            .getPublicUrl(filePath);
                          window.open(data.publicUrl, '_blank');
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {(budget.status === 'draft' || budget.status === 'rejected') && (
              <Button onClick={() => onEdit(budgetId)} variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edytuj
              </Button>
            )}
            {budget.status === 'submitted' && (user?.role === 'admin' || user?.role === 'prowincjal') && (
              <>
                <Button onClick={handleApprove} disabled={isApproving || isRejecting}>
                  {isApproving && <Spinner size="sm" className="mr-2" />}
                  {!isApproving && <Check className="mr-2 h-4 w-4" />}
                  Zatwierdź
                </Button>
                <Button onClick={() => setShowRejectDialog(true)} variant="destructive" disabled={isApproving || isRejecting}>
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

      {/* Dialog odrzucenia budżetu */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Odrzucenie budżetu</DialogTitle>
            <DialogDescription>
              Podaj powód odrzucenia budżetu na rok {budget.year} dla lokalizacji {(budget.locations as any)?.name}. 
              Ekonom otrzyma powiadomienie i będzie mógł poprawić budżet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Powód odrzucenia / uwagi do poprawy</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Opisz co wymaga poprawy..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isRejecting}>
              Anuluj
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={isRejecting || !rejectionReason.trim()}
            >
              {isRejecting && <Spinner size="sm" className="mr-2" />}
              {!isRejecting && <X className="mr-2 h-4 w-4" />}
              Odrzuć budżet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetView;