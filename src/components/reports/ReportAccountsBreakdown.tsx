
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/Spinner';

interface AccountBreakdown {
  account_number: string;
  account_name: string;
  account_type: string;
  total_amount: number;
  category: 'income' | 'expense' | 'settlement' | 'other';
}

interface ReportAccountsBreakdownProps {
  reportId: string;
  locationId: string;
  month: number;
  year: number;
}

const ReportAccountsBreakdown: React.FC<ReportAccountsBreakdownProps> = ({ 
  reportId, 
  locationId, 
  month, 
  year 
}) => {
  // Pobieranie szczegółowej rozpiski kont dla raportu
  const { data: accountsBreakdown, isLoading } = useQuery({
    queryKey: ['report_accounts_breakdown', reportId, locationId, month, year],
    queryFn: async () => {
      // Oblicz daty na podstawie miesiąca i roku
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

      console.log('Pobieranie rozpiski kont dla okresu:', dateFrom, 'do', dateTo);

      // Pobierz wszystkie transakcje dla danej lokalizacji w okresie
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          debit_account_id,
          credit_account_id,
          debit_account:accounts!debit_account_id(number, name, type),
          credit_account:accounts!credit_account_id(number, name, type)
        `)
        .eq('location_id', locationId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      console.log('Pobrane transakcje:', transactions?.length || 0);

      // Zgrupuj transakcje według kont i oblicz sumy
      const accountTotals = new Map<string, AccountBreakdown>();

      transactions?.forEach(transaction => {
        const { amount, debit_account, credit_account } = transaction;

        // Dla konta debetowego
        if (debit_account) {
          const key = `${debit_account.number}_debit`;
          const existing = accountTotals.get(key);
          
          if (existing) {
            existing.total_amount += Number(amount);
          } else {
            accountTotals.set(key, {
              account_number: debit_account.number,
              account_name: debit_account.name,
              account_type: debit_account.type,
              total_amount: Number(amount),
              category: categorizeAccount(debit_account.number, 'debit')
            });
          }
        }

        // Dla konta kredytowego
        if (credit_account) {
          const key = `${credit_account.number}_credit`;
          const existing = accountTotals.get(key);
          
          if (existing) {
            existing.total_amount += Number(amount);
          } else {
            accountTotals.set(key, {
              account_number: credit_account.number,
              account_name: credit_account.name,
              account_type: credit_account.type,
              total_amount: Number(amount),
              category: categorizeAccount(credit_account.number, 'credit')
            });
          }
        }
      });

      // Konwertuj mapę na tablicę i posortuj
      const breakdown = Array.from(accountTotals.values())
        .sort((a, b) => a.account_number.localeCompare(b.account_number))
        .filter(account => Math.abs(account.total_amount) > 0.01); // Filtruj konta z zerowym saldem

      console.log('Wygenerowana rozpiska kont:', breakdown.length);
      return breakdown;
    },
    enabled: !!reportId && !!locationId
  });

  // Funkcja do kategoryzacji kont
  const categorizeAccount = (accountNumber: string, side: 'debit' | 'credit'): 'income' | 'expense' | 'settlement' | 'other' => {
    const firstDigit = accountNumber.charAt(0);
    
    // Przychody: konta 7xx po stronie kredytowej ORAZ konta 2xx po stronie kredytowej
    if ((firstDigit === '7' && side === 'credit') || (firstDigit === '2' && side === 'credit')) {
      return 'income';
    }
    
    // Koszty: konta 4xx po stronie debetowej ORAZ konta 2xx po stronie debetowej
    if ((firstDigit === '4' && side === 'debit') || (firstDigit === '2' && side === 'debit')) {
      return 'expense';
    }
    
    // Rozrachunki: głównie konta 3xx
    if (firstDigit === '3') {
      return 'settlement';
    }
    
    return 'other';
  };

  // Formatowanie wartości walutowych
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  // Grupowanie kont według kategorii
  const groupedAccounts = accountsBreakdown?.reduce((groups, account) => {
    const category = account.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(account);
    return groups;
  }, {} as Record<string, AccountBreakdown[]>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Szczegółowa rozpiska kont</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <Spinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!accountsBreakdown || accountsBreakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Szczegółowa rozpiska kont</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-omi-gray-500 text-center py-4">
            Brak transakcji dla wybranego okresu.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'income':
        return '📈 Przychody';
      case 'expense':
        return '📉 Koszty';
      case 'settlement':
        return '🔄 Rozrachunki';
      default:
        return '📊 Pozostałe';
    }
  };

  const getCategoryTotal = (accounts: AccountBreakdown[]) => {
    return accounts.reduce((sum, account) => sum + account.total_amount, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Szczegółowa rozpiska kont</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedAccounts || {}).map(([category, accounts]) => (
          <div key={category}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">{getCategoryTitle(category)}</h3>
              <div className="text-lg font-bold">
                {formatCurrency(getCategoryTotal(accounts))}
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer konta</TableHead>
                  <TableHead>Nazwa konta</TableHead>
                  <TableHead>Typ konta</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account, index) => (
                  <TableRow key={`${account.account_number}_${index}`}>
                    <TableCell className="font-medium">
                      {account.account_number}
                    </TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell>
                      <span className="text-sm text-omi-gray-500">
                        {account.account_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(account.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
        
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Suma kontrolna:</span>
            <span className="text-lg font-bold">
              {formatCurrency(accountsBreakdown.reduce((sum, account) => sum + account.total_amount, 0))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportAccountsBreakdown;
