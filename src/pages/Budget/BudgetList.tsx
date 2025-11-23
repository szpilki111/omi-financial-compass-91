import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { BudgetPlan } from '@/types/budget';

interface BudgetListProps {
  onView: (budgetId: string) => void;
  onEdit: (budgetId: string) => void;
  filterYear?: number | null;
  filterLocationId?: string | null;
  filterStatus?: string | null;
  searchText?: string;
}

const BudgetList = ({ onView, onEdit, filterYear, filterLocationId, filterStatus, searchText }: BudgetListProps) => {
  const { user } = useAuth();

  const { data: budgets, isLoading, refetch } = useQuery({
    queryKey: ['budget-plans', user?.id, filterYear, filterLocationId, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('budget_plans')
        .select(`
          *,
          locations(name),
          created_by_profile:profiles!budget_plans_created_by_fkey(name),
          submitted_by_profile:profiles!budget_plans_submitted_by_fkey(name),
          approved_by_profile:profiles!budget_plans_approved_by_fkey(name)
        `)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filterYear) {
        query = query.eq('year', filterYear);
      }
      if (filterLocationId) {
        query = query.eq('location_id', filterLocationId);
      }
      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const handleDelete = async (budgetId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten budżet?')) return;

    const { error } = await supabase
      .from('budget_plans')
      .delete()
      .eq('id', budgetId);

    if (error) {
      console.error('[BUDGET] Error deleting budget:', error);
      
      if (error.code === '42501' || error.message?.includes('permission')) {
        toast.error('[BŁĄD UPRAWNIEŃ] Nie masz uprawnień do usunięcia tego budżetu');
      } else {
        toast.error(`[BŁĄD APLIKACJI] Błąd usuwania budżetu: ${error.message}`);
      }
      return;
    }

    toast.success('Budżet został usunięty');
    refetch();
  };

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

  if (isLoading) {
    return <div>Ładowanie budżetów...</div>;
  }

  // Client-side text search filter
  const filteredBudgets = budgets?.filter(budget => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    const locationName = (budget.locations as any)?.name?.toLowerCase() || '';
    const creatorName = budget.created_by_profile?.name?.toLowerCase() || '';
    return locationName.includes(searchLower) || creatorName.includes(searchLower);
  });

  if (!filteredBudgets || filteredBudgets.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            {searchText || filterYear || filterLocationId || (filterStatus && filterStatus !== 'all')
              ? 'Nie znaleziono budżetów pasujących do wybranych filtrów.'
              : 'Brak budżetów. Kliknij "Nowy budżet" aby utworzyć pierwszy plan budżetowy.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredBudgets.map((budget) => (
        <Card key={budget.id}>
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
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                Utworzony: {new Date(budget.created_at).toLocaleDateString('pl-PL')}
              </div>
              {budget.submitted_at && (
                <div>
                  Złożony: {new Date(budget.submitted_at).toLocaleDateString('pl-PL')}
                </div>
              )}
              {budget.approved_at && (
                <div>
                  Zatwierdzony: {new Date(budget.approved_at).toLocaleDateString('pl-PL')}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onView(budget.id)}
              >
                <Eye className="mr-1 h-4 w-4" />
                Zobacz
              </Button>
              {budget.status === 'draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(budget.id)}
                >
                  <Edit className="mr-1 h-4 w-4" />
                  Edytuj
                </Button>
              )}
              {(user?.role === 'admin' || user?.role === 'prowincjal') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(budget.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BudgetList;