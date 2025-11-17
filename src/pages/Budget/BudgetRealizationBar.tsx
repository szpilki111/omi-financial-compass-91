import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getBudgetRealizationForMonth, MONTH_NAMES, formatCurrency } from '@/utils/budgetUtils';

interface BudgetRealizationBarProps {
  locationId: string;
  year: number;
  budgetItems: any[];
}

const BudgetRealizationBar = ({ locationId, year, budgetItems }: BudgetRealizationBarProps) => {
  const totalBudget = budgetItems
    .filter((item: any) => item.account_type === 'expense')
    .reduce((sum: number, item: any) => sum + item.planned_amount, 0);

  const monthlyBudget = totalBudget / 12;

  const { data: realizationData } = useQuery({
    queryKey: ['budget-realization', locationId, year],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      
      const data = await Promise.all(
        months.map(async (month) => {
          if (month > currentMonth && new Date().getFullYear() === year) {
            return {
              month,
              monthName: MONTH_NAMES[month - 1],
              budgeted: monthlyBudget,
              actual: 0,
              percentage: 0,
              status: 'gray' as const,
              remaining: monthlyBudget,
            };
          }

          const realization = await getBudgetRealizationForMonth(
            locationId,
            year,
            month,
            monthlyBudget
          );

          return {
            month,
            monthName: MONTH_NAMES[month - 1],
            budgeted: monthlyBudget,
            actual: realization.actual,
            percentage: realization.percentage,
            status: realization.status,
            remaining: monthlyBudget - realization.actual,
          };
        })
      );

      return data;
    },
  });

  const getStatusColor = (status: 'green' | 'orange' | 'red' | 'gray') => {
    switch (status) {
      case 'green':
        return 'bg-green-500';
      case 'orange':
        return 'bg-orange-500';
      case 'red':
        return 'bg-red-500';
      case 'gray':
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: 'green' | 'orange' | 'red' | 'gray') => {
    switch (status) {
      case 'green':
        return 'W normie';
      case 'orange':
        return 'Powyżej';
      case 'red':
        return 'Przekroczony';
      case 'gray':
        return 'Niezrealizowany';
    }
  };

  if (!realizationData) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Realizacja budżetu {year}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {realizationData.map((data) => (
          <div key={data.month} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{data.monthName}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {data.percentage.toFixed(0)}%
                </span>
                <span className={`text-sm px-2 py-0.5 rounded ${
                  data.status === 'green' ? 'bg-green-100 text-green-700' :
                  data.status === 'orange' ? 'bg-orange-100 text-orange-700' :
                  data.status === 'red' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {getStatusText(data.status)}
                </span>
              </div>
            </div>
            <Progress
              value={Math.min(data.percentage, 100)}
              className="h-6"
              indicatorClassName={getStatusColor(data.status)}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Plan: {formatCurrency(data.budgeted)}</span>
              <span>Realizacja: {formatCurrency(data.actual)}</span>
              <span className={data.remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                {data.remaining >= 0 ? 'Pozostało' : 'Przekroczono o'}: {formatCurrency(Math.abs(data.remaining))}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BudgetRealizationBar;
