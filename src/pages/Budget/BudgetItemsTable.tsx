import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/budgetUtils';

interface BudgetItem {
  account_prefix: string;
  account_name: string;
  forecasted: number;
  planned: number;
  previous: number;
}

interface BudgetItemsTableProps {
  incomeItems: BudgetItem[];
  expenseItems: BudgetItem[];
  onUpdateIncome: (items: BudgetItem[]) => void;
  onUpdateExpenses: (items: BudgetItem[]) => void;
  readonly?: boolean;
}

const BudgetItemsTable = ({
  incomeItems,
  expenseItems,
  onUpdateIncome,
  onUpdateExpenses,
  readonly = false,
}: BudgetItemsTableProps) => {
  const handleIncomeChange = (index: number, value: number) => {
    const updated = [...incomeItems];
    updated[index].planned = value;
    onUpdateIncome(updated);
  };

  const handleExpenseChange = (index: number, value: number) => {
    const updated = [...expenseItems];
    updated[index].planned = value;
    onUpdateExpenses(updated);
  };

  const totalIncome = incomeItems.reduce((sum, item) => sum + item.planned, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.planned, 0);
  const balance = totalIncome - totalExpenses;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Income */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Przychody (7xx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {incomeItems.map((item, index) => (
                <div key={item.account_prefix} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {item.account_prefix} - {item.account_name}
                  </Label>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Prognoza:</span>
                      <span>{formatCurrency(item.forecasted)}</span>
                    </div>
                    {!readonly && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Budżet:</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.planned}
                          onChange={(e) => handleIncomeChange(index, parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    )}
                    {readonly && (
                      <div className="flex justify-between font-medium">
                        <span>Budżet:</span>
                        <span>{formatCurrency(item.planned)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Poprz. rok:</span>
                      <span>{formatCurrency(item.previous)}</span>
                    </div>
                  </div>
                  {index < incomeItems.length - 1 && <div className="border-t my-2" />}
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>SUMA PRZYCHODÓW:</span>
                  <span className="text-green-600">{formatCurrency(totalIncome)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rozchody (4xx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {expenseItems.map((item, index) => (
                <div key={item.account_prefix} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {item.account_prefix} - {item.account_name}
                  </Label>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Prognoza:</span>
                      <span>{formatCurrency(item.forecasted)}</span>
                    </div>
                    {!readonly && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Budżet:</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.planned}
                          onChange={(e) => handleExpenseChange(index, parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    )}
                    {readonly && (
                      <div className="flex justify-between font-medium">
                        <span>Budżet:</span>
                        <span>{formatCurrency(item.planned)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Poprz. rok:</span>
                      <span>{formatCurrency(item.previous)}</span>
                    </div>
                  </div>
                  {index < expenseItems.length - 1 && <div className="border-t my-2" />}
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>SUMA ROZCHODÓW:</span>
                  <span className="text-red-600">{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center text-xl font-bold">
            <span>WYNIK FINANSOWY:</span>
            <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(balance)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetItemsTable;
