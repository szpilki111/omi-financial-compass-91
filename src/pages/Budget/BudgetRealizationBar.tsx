import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getBudgetRealizationForMonthDetailed, getBudgetStatus, MONTH_NAMES, formatCurrency } from '@/utils/budgetUtils';

interface BudgetRealizationBarProps {
  locationId: string;
  year: number;
  budgetItems: any[];
}

const BudgetRealizationBar = ({ locationId, year, budgetItems }: BudgetRealizationBarProps) => {
  const totalExpenseBudget = budgetItems
    .filter((item: any) => item.account_type === 'expense')
    .reduce((sum: number, item: any) => sum + item.planned_amount, 0);

  const totalIncomeBudget = budgetItems
    .filter((item: any) => item.account_type === 'income')
    .reduce((sum: number, item: any) => sum + item.planned_amount, 0);

  const monthlyExpenseBudget = totalExpenseBudget / 12;
  const monthlyIncomeBudget = totalIncomeBudget / 12;

  const { data: realizationData } = useQuery({
    queryKey: ['budget-realization-detailed', locationId, year],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      let yearlyExpenseActual = 0;
      let yearlyIncomeActual = 0;

      await Promise.all(
        months.map(async (month) => {
          if (month > currentMonth && currentYear === year) {
            return;
          }

          const realization = await getBudgetRealizationForMonthDetailed(
            locationId, year, month, monthlyExpenseBudget, monthlyIncomeBudget
          );

          yearlyExpenseActual += realization.expenseActual;
          yearlyIncomeActual += realization.incomeActual;
        })
      );

      const yearlyExpensePercentage = totalExpenseBudget > 0
        ? (yearlyExpenseActual / totalExpenseBudget) * 100 : 0;
      const yearlyIncomePercentage = totalIncomeBudget > 0
        ? (yearlyIncomeActual / totalIncomeBudget) * 100 : 0;

      return {
        yearly: {
          expenseActual: yearlyExpenseActual,
          expensePercentage: yearlyExpensePercentage,
          expenseStatus: getBudgetStatus(yearlyExpensePercentage),
          expenseRemaining: totalExpenseBudget - yearlyExpenseActual,
          incomeActual: yearlyIncomeActual,
          incomePercentage: yearlyIncomePercentage,
          incomeStatus: getBudgetStatus(yearlyIncomePercentage),
          incomeRemaining: totalIncomeBudget - yearlyIncomeActual,
        },
      };
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'orange': return 'bg-orange-500';
      case 'red': return 'bg-red-500';
      case 'gray': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'green': return 'W normie';
      case 'orange': return 'Powyżej normy';
      case 'red': return 'Przekroczony';
      case 'gray': return 'Niezrealizowany';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-100 text-green-700';
      case 'orange': return 'bg-orange-100 text-orange-700';
      case 'red': return 'bg-red-100 text-red-700';
      case 'gray': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!realizationData) return null;

  const { yearly } = realizationData;

  return (
    <div className="space-y-4">
      {/* Yearly expense bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Realizacja budżetu rocznego {year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Expenses */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-red-700">Koszty (4xx)</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {yearly.expensePercentage.toFixed(1)}%
                </span>
                <span className={`text-sm px-2 py-0.5 rounded ${getStatusBadge(yearly.expenseStatus)}`}>
                  {getStatusText(yearly.expenseStatus)}
                </span>
              </div>
            </div>
            <Progress
              value={Math.min(yearly.expensePercentage, 100)}
              className="h-8"
              indicatorClassName={getStatusColor(yearly.expenseStatus)}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Plan roczny: {formatCurrency(totalExpenseBudget)}</span>
              <span>Wydano: {formatCurrency(yearly.expenseActual)}</span>
              <span className={yearly.expenseRemaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                {yearly.expenseRemaining >= 0 ? 'Pozostało' : 'Przekroczono o'}: {formatCurrency(Math.abs(yearly.expenseRemaining))}
              </span>
            </div>
          </div>

          {/* Income */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700">Przychody (7xx)</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {yearly.incomePercentage.toFixed(1)}%
                </span>
                <span className={`text-sm px-2 py-0.5 rounded ${getStatusBadge(yearly.incomeStatus)}`}>
                  {getStatusText(yearly.incomeStatus)}
                </span>
              </div>
            </div>
            <Progress
              value={Math.min(yearly.incomePercentage, 100)}
              className="h-8"
              indicatorClassName="bg-blue-500"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Plan roczny: {formatCurrency(totalIncomeBudget)}</span>
              <span>Uzyskano: {formatCurrency(yearly.incomeActual)}</span>
              <span className={yearly.incomeRemaining >= 0 ? 'text-blue-600' : 'text-red-600'}>
                {yearly.incomeRemaining >= 0 ? 'Pozostało' : 'Przekroczono o'}: {formatCurrency(Math.abs(yearly.incomeRemaining))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetRealizationBar;
