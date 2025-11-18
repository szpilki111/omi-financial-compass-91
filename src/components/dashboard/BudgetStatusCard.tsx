import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { getBudgetRealizationForMonth } from '@/utils/budgetUtils';

const BudgetStatusCard = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const { data: budgetStatus, isLoading } = useQuery({
    queryKey: ['budget-status', user?.location, currentYear, currentMonth],
    queryFn: async () => {
      if (!user?.location) return null;

      // Pobierz aktualny budżet dla lokalizacji
      const { data: budgetPlan, error: planError } = await supabase
        .from('budget_plans')
        .select('id, year, status')
        .eq('location_id', user.location)
        .eq('year', currentYear)
        .eq('status', 'approved')
        .maybeSingle();

      if (planError || !budgetPlan) return null;

      // Pobierz pozycje budżetowe (rozchody)
      const { data: budgetItems, error: itemsError } = await supabase
        .from('budget_items')
        .select('planned_amount')
        .eq('budget_plan_id', budgetPlan.id)
        .eq('account_type', 'expense');

      if (itemsError || !budgetItems) return null;

      // Suma roczna rozchodów
      const totalYearlyBudget = budgetItems.reduce((sum, item) => sum + (item.planned_amount || 0), 0);
      
      // Budżet miesięczny (roczny / 12)
      const monthlyBudget = totalYearlyBudget / 12;

      // Pobierz realizację budżetu dla bieżącego miesiąca
      const realization = await getBudgetRealizationForMonth(
        user.location,
        currentYear,
        currentMonth,
        monthlyBudget
      );

      return {
        monthlyBudget,
        ...realization
      };
    },
    enabled: !!user?.location
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Budżetu</CardTitle>
          <CardDescription>Ładowanie...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!budgetStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Budżetu</CardTitle>
          <CardDescription>Brak zatwierdzonego budżetu na {currentYear} rok</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/budzet" className="text-sm text-primary hover:underline">
            Utwórz budżet →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { monthlyBudget, actual, percentage, status } = budgetStatus;

  const getStatusColor = () => {
    switch (status) {
      case 'green': return 'text-green-600';
      case 'orange': return 'text-orange-600';
      case 'red': return 'text-red-600';
      case 'gray': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    if (status === 'red') return <AlertCircle className="h-5 w-5 text-red-600" />;
    if (percentage > 50) return <TrendingUp className="h-5 w-5 text-green-600" />;
    return <TrendingDown className="h-5 w-5 text-muted-foreground" />;
  };

  const getProgressColor = () => {
    switch (status) {
      case 'green': return 'bg-green-600';
      case 'orange': return 'bg-orange-600';
      case 'red': return 'bg-red-600';
      case 'gray': return 'bg-muted';
      default: return 'bg-primary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Status Budżetu</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
            </CardDescription>
          </div>
          {getStatusIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Realizacja</span>
            <span className={`font-semibold ${getStatusColor()}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={Math.min(percentage, 100)} 
            indicatorClassName={getProgressColor()}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Budżet miesięczny</p>
            <p className="font-semibold">
              {monthlyBudget.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Wydano</p>
            <p className="font-semibold">
              {actual.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
            </p>
          </div>
        </div>

        <Link 
          to="/budzet" 
          className="block text-sm text-primary hover:underline text-center"
        >
          Zobacz szczegóły budżetu →
        </Link>
      </CardContent>
    </Card>
  );
};

export default BudgetStatusCard;
