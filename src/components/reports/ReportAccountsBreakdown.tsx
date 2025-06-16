
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
  category: 'income' | 'expense' | 'other';
  side: 'debit' | 'credit';
}

interface ReportAccountsBreakdownProps {
  reportId: string;
  locationId: string;
  month: number;
  year: number;
  dateRange?: {
    from: string;
    to: string;
  };
}

const ReportAccountsBreakdown: React.FC<ReportAccountsBreakdownProps> = ({ 
  reportId, 
  locationId, 
  month, 
  year,
  dateRange 
}) => {
  // Pobieranie szczegółowej rozpiski kont dla raportu
  const { data: accountsBreakdown, isLoading } = useQuery({
    queryKey: ['report_accounts_breakdown', reportId, locationId, month, year, dateRange],
    queryFn: async () => {
      let dateFrom: string;
      let dateTo: string;

      // Jeśli podano niestandardowy zakres dat, użyj go
      if (dateRange) {
        dateFrom = dateRange.from;
        dateTo = dateRange.to;
      } else {
        // W przeciwnym razie oblicz daty na podstawie miesiąca i roku
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);
        
        dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        dateTo = lastDayOfMonth.toISOString().split('T')[0];
      }

      // Pobierz wszystkie transakcje dla danej lokalizacji w okresie
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          debit_account_id,
          credit_account_id,
          debit_amount,
          credit_amount,
          description,
          document_number,
          debit_account:accounts!debit_account_id(number, name, type),
          credit_account:accounts!credit_account_id(number, name, type)
        `)
        .eq('location_id', locationId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      // Funkcja do sprawdzania czy konto należy do kategorii przychodów/kosztów
      const isRelevantAccount = (accountNumber: string) => {
        if (!accountNumber) return false;
        return accountNumber.startsWith('2') || accountNumber.startsWith('4') || accountNumber.startsWith('7');
      };

      // Zgrupuj transakcje według kont i oblicz sumy - TYLKO dla kont 2xx, 4xx, 7xx
      const accountTotals = new Map<string, AccountBreakdown>();

      transactions?.forEach(transaction => {
        const { amount, debit_account, credit_account, debit_amount, credit_amount } = transaction;

        // Dla konta debetowego - sprawdź czy to konto 2xx, 4xx lub 7xx
        if (debit_account && isRelevantAccount(debit_account.number)) {
          const key = `${debit_account.number}_debit`;
          const existing = accountTotals.get(key);
          
          // Użyj debit_amount jeśli jest dostępne, w przeciwnym razie amount
          const transactionAmount = debit_amount && debit_amount > 0 ? debit_amount : Number(amount);
          
          if (existing) {
            existing.total_amount += transactionAmount;
          } else {
            accountTotals.set(key, {
              account_number: debit_account.number,
              account_name: debit_account.name,
              account_type: debit_account.type,
              total_amount: transactionAmount,
              category: categorizeAccount(debit_account.number, 'debit'),
              side: 'debit'
            });
          }
        }

        // Dla konta kredytowego - sprawdź czy to konto 2xx, 4xx lub 7xx
        if (credit_account && isRelevantAccount(credit_account.number)) {
          const key = `${credit_account.number}_credit`;
          const existing = accountTotals.get(key);
          
          // Użyj credit_amount jeśli jest dostępne, w przeciwnym razie amount
          const transactionAmount = credit_amount && credit_amount > 0 ? credit_amount : Number(amount);
          
          if (existing) {
            existing.total_amount += transactionAmount;
          } else {
            accountTotals.set(key, {
              account_number: credit_account.number,
              account_name: credit_account.name,
              account_type: credit_account.type,
              total_amount: transactionAmount,
              category: categorizeAccount(credit_account.number, 'credit'),
              side: 'credit'
            });
          }
        }
      });

      // Konwertuj mapę na tablicę i posortuj
      const breakdown = Array.from(accountTotals.values())
        .filter(account => {
          // Filtruj tylko konta, które rzeczywiście wpływają na przychody/koszty
          return account.category === 'income' || account.category === 'expense';
        })
        .filter(account => Math.abs(account.total_amount) > 0.01) // Filtruj konta z zerowym saldem
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      return breakdown;
    },
    enabled: !!locationId
  });

  // Funkcja do kategoryzacji kont - TYLKO konta wpływające na przychody/koszty
  const categorizeAccount = (accountNumber: string, side: 'debit' | 'credit'): 'income' | 'expense' | 'other' => {
    if (!accountNumber) return 'other';
    
    // Przychody: konta 7xx po stronie kredytowej ORAZ konta 2xx po stronie kredytowej
    if ((accountNumber.startsWith('7') && side === 'credit') || (accountNumber.startsWith('2') && side === 'credit')) {
      return 'income';
    }
    
    // Koszty: konta 4xx po stronie debetowej ORAZ konta 2xx po stronie debetowej
    if ((accountNumber.startsWith('4') && side === 'debit') || (accountNumber.startsWith('2') && side === 'debit')) {
      return 'expense';
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
          <CardTitle>
            {dateRange 
              ? `Szczegółowa rozpiska kont (${dateRange.from} - ${dateRange.to})`
              : 'Szczegółowa rozpiska kont'
            }
          </CardTitle>
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
          <CardTitle>
            {dateRange 
              ? `Szczegółowa rozpiska kont (${dateRange.from} - ${dateRange.to})`
              : 'Szczegółowa rozpiska kont'
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-omi-gray-500 text-center py-4">
            Brak transakcji z kont wynikowych (200, 400, 700) dla wybranego okresu.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'income':
        return '📈 Przychody (konta 7xx i 2xx po stronie MA)';
      case 'expense':
        return '📉 Koszty (konta 4xx i 2xx po stronie WN)';
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
        <p className="text-sm text-omi-gray-500">
          Pokazuje tylko konta wpływające na wynik finansowy (200, 400, 700)
        </p>
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
                  <TableHead>Strona</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account, index) => (
                  <TableRow key={`${account.account_number}_${account.side}_${index}`}>
                    <TableCell className="font-medium">
                      {account.account_number}
                    </TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell>
                      <span className={`text-sm px-2 py-1 rounded ${
                        account.side === 'debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {account.side === 'debit' ? 'WN' : 'MA'}
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
          <p className="text-xs text-omi-gray-500 mt-2">
            * Suma kontrolna nie powinna być zerowa - reprezentuje różnicę między obrotami Ma i Wn
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportAccountsBreakdown;
