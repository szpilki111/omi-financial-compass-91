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

      const monthlyData = await Promise.all(
        months.map(async (month) => {
          if (month > currentMonth && currentYear === year) {
            return {
              month,
              monthName: MONTH_NAMES[month - 1],
              expenseActual: 0, incomeActual: 0,
              expensePercentage: 0, incomePercentage: 0,
              expenseStatus: 'gray' as const, incomeStatus: 'gray' as const,
              expenseRemaining: monthlyExpenseBudget,
              incomeRemaining: monthlyIncomeBudget,
              isFuture: true,
            };
          }

          const realization = await getBudgetRealizationForMonthDetailed(
            locationId, year, month, monthlyExpenseBudget, monthlyIncomeBudget
          );

          yearlyExpenseActual += realization.expenseActual;

          return {
            month,
            monthName: MONTH_NAMES[month - 1],
            ...realization,
            expenseRemaining: monthlyExpenseBudget - realization.expenseActual,
            incomeRemaining: monthlyIncomeBudget - realization.incomeActual,
            isFuture: false,
          };
        })
      );

      const yearlyExpensePercentage = totalExpenseBudget > 0
        ? (yearlyExpenseActual / totalExpenseBudget) * 100 : 0;

      return {
        monthly: monthlyData,
        yearly: {
          expenseActual: yearlyExpenseActual,
          expensePercentage: yearlyExpensePercentage,
          expenseStatus: getBudgetStatus(yearlyExpensePercentage),
          expenseRemaining: totalExpenseBudget - yearlyExpenseActual,
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
      case 'orange': return 'Powyżej';
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

  const { yearly, monthly } = realizationData;

  return (
    <div className="space-y-4">
      {/* Yearly summary bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Realizacja budżetu rocznego {year} — Koszty (4xx)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Wydano łącznie</span>
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
        </CardContent>
      </Card>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Realizacja miesięczna {year}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {monthly.map((data) => (
            <div key={data.month} className="space-y-3">
              <div className="font-medium text-base border-b pb-1">{data.monthName}</div>

              {/* Expense bar (4xx) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">Koszty (4xx)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {data.expensePercentage.toFixed(0)}%
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(data.expenseStatus)}`}>
                      {getStatusText(data.expenseStatus)}
                    </span>
                  </div>
                </div>
                <Progress
                  value={Math.min(data.expensePercentage, 100)}
                  className="h-5"
                  indicatorClassName={getStatusColor(data.expenseStatus)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Plan: {formatCurrency(monthlyExpenseBudget)}</span>
                  <span>Realizacja: {formatCurrency(data.expenseActual)}</span>
                  <span className={data.expenseRemaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {data.expenseRemaining >= 0 ? 'Pozostało' : 'Przekroczono o'}: {formatCurrency(Math.abs(data.expenseRemaining))}
                  </span>
                </div>
              </div>

              {/* Income bar (7xx) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">Przychody (7xx)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {data.incomePercentage.toFixed(0)}%
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(data.incomeStatus)}`}>
                      {getStatusText(data.incomeStatus)}
                    </span>
                  </div>
                </div>
                <Progress
                  value={Math.min(data.incomePercentage, 100)}
                  className="h-5"
                  indicatorClassName="bg-blue-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Plan: {formatCurrency(monthlyIncomeBudget)}</span>
                  <span>Realizacja: {formatCurrency(data.incomeActual)}</span>
                  <span className={data.incomeRemaining >= 0 ? 'text-blue-600' : 'text-red-600'}>
                    {data.incomeRemaining >= 0 ? 'Pozostało' : 'Przekroczono o'}: {formatCurrency(Math.abs(data.incomeRemaining))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetRealizationBar;
