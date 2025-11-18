import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { MONTH_NAMES, formatCurrency } from '@/utils/budgetUtils';

interface DeviationData {
  accountPrefix: string;
  accountName: string;
  budgeted: number;
  actual: number;
  deviation: number;
  percentage: number;
}

const BudgetDeviationReport = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonth);
  const [accountType, setAccountType] = useState<'income' | 'expense' | 'all'>('all');

  const { data: deviations, isLoading } = useQuery({
    queryKey: ['budget-deviations', user?.location, selectedYear, selectedMonth, accountType],
    queryFn: async () => {
      if (!user?.location) return [];

      // Pobierz budżet
      const { data: budgetPlan, error: planError } = await supabase
        .from('budget_plans')
        .select('id')
        .eq('location_id', user.location)
        .eq('year', selectedYear)
        .eq('status', 'approved')
        .maybeSingle();

      if (planError || !budgetPlan) return [];

      // Pobierz pozycje budżetowe
      let itemsQuery = supabase
        .from('budget_items')
        .select('*')
        .eq('budget_plan_id', budgetPlan.id);

      if (accountType !== 'all') {
        itemsQuery = itemsQuery.eq('account_type', accountType);
      }

      const { data: budgetItems, error: itemsError } = await itemsQuery;

      if (itemsError || !budgetItems) return [];

      // Dla każdej pozycji budżetowej pobierz rzeczywistą realizację
      const deviationPromises = budgetItems.map(async (item) => {
        let transactionsQuery = supabase
          .from('transactions')
          .select('debit_amount, credit_amount')
          .eq('location_id', user.location)
          .gte('date', `${selectedYear}-01-01`)
          .lte('date', `${selectedYear}-12-31`);

        // Jeśli wybrany konkretny miesiąc
        if (selectedMonth !== 'all') {
          const monthStr = String(selectedMonth).padStart(2, '0');
          transactionsQuery = transactionsQuery
            .gte('date', `${selectedYear}-${monthStr}-01`)
            .lte('date', `${selectedYear}-${monthStr}-31`);
        }

        // Filtruj transakcje wg konta
        if (item.account_type === 'income') {
          transactionsQuery = transactionsQuery.like('credit_account_id', `%${item.account_prefix.split('-')[0]}%`);
        } else {
          transactionsQuery = transactionsQuery.like('debit_account_id', `%${item.account_prefix.split('-')[0]}%`);
        }

        const { data: transactions } = await transactionsQuery;

        const actual = transactions?.reduce((sum, t) => {
          if (item.account_type === 'income') {
            return sum + (t.credit_amount || 0);
          } else {
            return sum + (t.debit_amount || 0);
          }
        }, 0) || 0;

        // Budżet do porównania
        let budgeted = item.planned_amount;
        if (selectedMonth !== 'all') {
          budgeted = item.planned_amount / 12; // miesięczny budżet
        }

        const deviation = actual - budgeted;
        const percentage = budgeted > 0 ? (deviation / budgeted) * 100 : 0;

        return {
          accountPrefix: item.account_prefix,
          accountName: item.account_name,
          budgeted,
          actual,
          deviation,
          percentage
        };
      });

      const results = await Promise.all(deviationPromises);
      return results.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    },
    enabled: !!user?.location
  });

  const exportToCSV = () => {
    if (!deviations || deviations.length === 0) return;

    const headers = ['Konto', 'Nazwa', 'Budżet', 'Realizacja', 'Odchylenie', 'Odchylenie %'];
    const rows = deviations.map(d => [
      d.accountPrefix,
      d.accountName,
      d.budgeted.toFixed(2),
      d.actual.toFixed(2),
      d.deviation.toFixed(2),
      d.percentage.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `odchylenia_budzetowe_${selectedYear}_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Raport Odchyleń Budżetowych</CardTitle>
          <CardDescription>
            Porównanie planowanego budżetu z rzeczywistą realizacją
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Rok</label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Miesiąc</label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(v === 'all' ? 'all' : Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cały rok</SelectItem>
                  {MONTH_NAMES.map((month, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Typ konta</label>
              <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="income">Przychody</SelectItem>
                  <SelectItem value="expense">Rozchody</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" size="sm" disabled={!deviations || deviations.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Eksport CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Ładowanie...</p>
          ) : !deviations || deviations.length === 0 ? (
            <p className="text-center text-muted-foreground">Brak danych do wyświetlenia</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="text-right">Budżet</TableHead>
                  <TableHead className="text-right">Realizacja</TableHead>
                  <TableHead className="text-right">Odchylenie</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviations.map((deviation, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{deviation.accountPrefix}</TableCell>
                    <TableCell>{deviation.accountName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(deviation.budgeted)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(deviation.actual)}</TableCell>
                    <TableCell className={`text-right font-semibold ${
                      deviation.deviation > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(deviation.deviation)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${
                      Math.abs(deviation.percentage) > 20 ? 'text-red-600' : 
                      Math.abs(deviation.percentage) > 10 ? 'text-orange-600' : 
                      'text-green-600'
                    }`}>
                      {deviation.percentage > 0 ? '+' : ''}{deviation.percentage.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetDeviationReport;
