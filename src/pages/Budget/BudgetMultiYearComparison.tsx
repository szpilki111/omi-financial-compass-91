import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/utils/budgetUtils';
import { useAuth } from '@/context/AuthContext';

interface BudgetMultiYearComparisonProps {
  // No props needed
}

const BudgetMultiYearComparison = ({}: BudgetMultiYearComparisonProps) => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear - 2);
  const [endYear, setEndYear] = useState(currentYear);
  const [selectedLocation, setSelectedLocation] = useState<string>(user?.location || '');

  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations-for-comparison', user?.id],
    queryFn: async () => {
      if (user?.role === 'admin' || user?.role === 'prowincjal') {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .order('name');
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .eq('id', user?.location)
          .single();
        if (error) throw error;
        return [data];
      }
    },
    enabled: !!user,
  });

  // Fetch multi-year data
  const { data: comparisonData, isLoading } = useQuery({
    queryKey: ['budget-multi-year', selectedLocation, startYear, endYear],
    queryFn: async () => {
      if (!selectedLocation) return null;

      // Fetch all budgets for the location in the year range
      const { data: budgets, error: budgetError } = await supabase
        .from('budget_plans')
        .select('*, budget_items(*)')
        .eq('location_id', selectedLocation)
        .gte('year', startYear)
        .lte('year', endYear)
        .order('year');

      if (budgetError) throw budgetError;

      // Fetch all transactions for the location in the year range
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('date, debit_account_id, credit_account_id, debit_amount, credit_amount, accounts!transactions_debit_account_id_fkey(number), credit_account:accounts!transactions_credit_account_id_fkey(number)')
        .eq('location_id', selectedLocation)
        .gte('date', `${startYear}-01-01`)
        .lte('date', `${endYear}-12-31`);

      if (transError) throw transError;

      // Organize data by account and year
      const accountData: Record<string, {
        account_prefix: string;
        account_name: string;
        account_type: 'income' | 'expense';
        yearData: Record<number, { budget: number; actual: number }>;
      }> = {};

      // Process budgets
      budgets?.forEach((budget: any) => {
        budget.budget_items?.forEach((item: any) => {
          if (!accountData[item.account_prefix]) {
            accountData[item.account_prefix] = {
              account_prefix: item.account_prefix,
              account_name: item.account_name,
              account_type: item.account_type,
              yearData: {},
            };
          }
          if (!accountData[item.account_prefix].yearData[budget.year]) {
            accountData[item.account_prefix].yearData[budget.year] = { budget: 0, actual: 0 };
          }
          accountData[item.account_prefix].yearData[budget.year].budget = item.planned_amount;
        });
      });

      // Process transactions to calculate actuals
      transactions?.forEach((trans: any) => {
        const year = new Date(trans.date).getFullYear();
        
        // Process debit (expense side)
        if (trans.debit_account_id && trans.accounts?.number) {
          const accountPrefix = trans.accounts.number.split('-')[0];
          if (accountData[accountPrefix]) {
            if (!accountData[accountPrefix].yearData[year]) {
              accountData[accountPrefix].yearData[year] = { budget: 0, actual: 0 };
            }
            accountData[accountPrefix].yearData[year].actual += trans.debit_amount || 0;
          }
        }

        // Process credit (income side)
        if (trans.credit_account_id && trans.credit_account?.number) {
          const accountPrefix = trans.credit_account.number.split('-')[0];
          if (accountData[accountPrefix]) {
            if (!accountData[accountPrefix].yearData[year]) {
              accountData[accountPrefix].yearData[year] = { budget: 0, actual: 0 };
            }
            accountData[accountPrefix].yearData[year].actual += trans.credit_amount || 0;
          }
        }
      });

      return Object.values(accountData).sort((a, b) => {
        if (a.account_type !== b.account_type) {
          return a.account_type === 'income' ? -1 : 1;
        }
        return a.account_prefix.localeCompare(b.account_prefix);
      });
    },
    enabled: !!selectedLocation,
  });

  const exportToCSV = () => {
    if (!comparisonData) return;

    const headers = ['Konto', 'Typ'];
    years.forEach(year => {
      headers.push(`Budżet ${year}`, `Realizacja ${year}`);
    });

    const rows = comparisonData.map(account => {
      const row = [
        `${account.account_prefix} ${account.account_name}`,
        account.account_type === 'income' ? 'Przychód' : 'Rozchód',
      ];
      years.forEach(year => {
        const data = account.yearData[year] || { budget: 0, actual: 0 };
        row.push(data.budget.toString(), data.actual.toString());
      });
      return row;
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `porownanie_wieloletnie_${startYear}-${endYear}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Porównanie wieloletnie</CardTitle>
        <CardDescription>
          Porównaj budżety i realizację z różnych lat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Lokalizacja</label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz lokalizację" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <label className="text-sm font-medium mb-2 block">Od roku</label>
            <Select value={startYear.toString()} onValueChange={(val) => setStartYear(parseInt(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <label className="text-sm font-medium mb-2 block">Do roku</label>
            <Select value={endYear.toString()} onValueChange={(val) => setEndYear(parseInt(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((year) => (
                  <SelectItem key={year} value={year.toString()} disabled={year < startYear}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={exportToCSV} disabled={!comparisonData}>
              <Download className="mr-2 h-4 w-4" />
              Eksportuj CSV
            </Button>
          </div>
        </div>

        {comparisonData && comparisonData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 bg-muted/50">
                  <th className="text-left p-3 font-semibold">Konto</th>
                  <th className="text-left p-3 font-semibold">Typ</th>
                  {years.map(year => (
                    <th key={year} className="text-center p-3 font-semibold" colSpan={2}>
                      {year}
                    </th>
                  ))}
                </tr>
                <tr className="border-b bg-muted/30">
                  <th className="p-3"></th>
                  <th className="p-3"></th>
                  {years.map(year => (
                    <>
                      <th key={`${year}-budget`} className="text-center p-2 text-sm">Budżet</th>
                      <th key={`${year}-actual`} className="text-center p-2 text-sm">Realizacja</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((account, idx) => (
                  <tr key={account.account_prefix} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                    <td className="p-3 font-medium">
                      {account.account_prefix} {account.account_name}
                    </td>
                    <td className="p-3">
                      <span className={account.account_type === 'income' ? 'text-green-600' : 'text-orange-600'}>
                        {account.account_type === 'income' ? 'Przychód' : 'Rozchód'}
                      </span>
                    </td>
                    {years.map(year => {
                      const data = account.yearData[year] || { budget: 0, actual: 0 };
                      return (
                        <>
                          <td key={`${year}-budget`} className="text-right p-3">
                            {formatCurrency(data.budget)}
                          </td>
                          <td key={`${year}-actual`} className="text-right p-3 font-medium">
                            {formatCurrency(data.actual)}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {selectedLocation ? 'Brak danych do wyświetlenia' : 'Wybierz lokalizację, aby zobaczyć porównanie'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetMultiYearComparison;
