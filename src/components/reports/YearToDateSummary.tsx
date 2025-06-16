
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/Spinner';
import { calculateFinancialSummary } from '@/utils/financeUtils';
import KpirSummary from '@/pages/KPIR/components/KpirSummary';

interface YearToDateSummaryProps {
  locationId: string;
  currentMonth: number;
  currentYear: number;
  isVisible: boolean;
}

interface AccountBreakdown {
  account_number: string;
  account_name: string;
  account_type: string;
  total_amount: number;
  category: string;
  side: 'debit' | 'credit';
}

const YearToDateSummary: React.FC<YearToDateSummaryProps> = ({
  locationId,
  currentMonth,
  currentYear,
  isVisible
}) => {
  // Pobieranie danych od początku roku do bieżącego miesiąca
  const { data: yearToDateData, isLoading } = useQuery({
    queryKey: ['year_to_date_summary', locationId, currentMonth, currentYear],
    queryFn: async () => {
      const dateFrom = `${currentYear}-01-01`;
      const dateTo = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      console.log(`📊 Pobieranie danych od początku roku: ${dateFrom} do ${dateTo}`);

      // Oblicz finansowe podsumowanie
      const summary = await calculateFinancialSummary(locationId, dateFrom, dateTo);

      // Pobierz szczegółową rozpiskę kont
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

      // Zgrupuj transakcje według kont
      const accountTotals = new Map();

      transactions?.forEach(transaction => {
        const { amount, debit_account, credit_account, debit_amount, credit_amount } = transaction;

        // Dla konta debetowego
        if (debit_account && isRelevantAccount(debit_account.number)) {
          const key = `${debit_account.number}_debit`;
          const existing = accountTotals.get(key);
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

        // Dla konta kredytowego
        if (credit_account && isRelevantAccount(credit_account.number)) {
          const key = `${credit_account.number}_credit`;
          const existing = accountTotals.get(key);
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

      const breakdown: AccountBreakdown[] = Array.from(accountTotals.values())
        .filter(account => account.category === 'income' || account.category === 'expense')
        .filter(account => Math.abs(account.total_amount) > 0.01)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      return {
        summary,
        breakdown,
        period: `${dateFrom} - ${dateTo}`
      };
    },
    enabled: !!locationId && isVisible
  });

  // Funkcja do kategoryzacji kont
  const categorizeAccount = (accountNumber: string, side: 'debit' | 'credit') => {
    if (!accountNumber) return 'other';
    
    if ((accountNumber.startsWith('7') && side === 'credit') || (accountNumber.startsWith('2') && side === 'credit')) {
      return 'income';
    }
    
    if ((accountNumber.startsWith('4') && side === 'debit') || (accountNumber.startsWith('2') && side === 'debit')) {
      return 'expense';
    }
    
    return 'other';
  };

  // Formatowanie wartości walutowych
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  if (!isVisible) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📅 Podsumowanie od początku roku</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <Spinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!yearToDateData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📅 Podsumowanie od początku roku</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-omi-gray-500 text-center py-4">
            Brak danych dla wybranego okresu.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Grupowanie kont według kategorii
  const groupedAccounts: Record<string, AccountBreakdown[]> = yearToDateData.breakdown?.reduce((groups, account) => {
    const category = account.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(account);
    return groups;
  }, {} as Record<string, AccountBreakdown[]>) || {};

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
        <CardTitle>📅 Podsumowanie od początku roku</CardTitle>
        <p className="text-sm text-omi-gray-500">
          Okres: {yearToDateData.period}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Podsumowanie finansowe */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Podsumowanie finansowe</h3>
          <KpirSummary 
            income={yearToDateData.summary.income}
            expense={yearToDateData.summary.expense}
            balance={yearToDateData.summary.balance}
            openingBalance={0} // Dla roku zawsze zaczynamy od 0
          />
        </div>

        {/* Szczegółowa rozpiska kont */}
        {yearToDateData.breakdown && yearToDateData.breakdown.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Szczegółowa rozpiska kont</h3>
            {Object.entries(groupedAccounts).map(([category, accounts]) => (
              <div key={category} className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-semibold">{getCategoryTitle(category)}</h4>
                  <div className="text-md font-bold">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YearToDateSummary;
