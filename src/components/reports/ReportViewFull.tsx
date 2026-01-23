import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ReportIncomeSection } from './ReportIncomeSection';
import { ReportExpenseSection } from './ReportExpenseSection';
import { ReportFinancialStatusTable, DEFAULT_CATEGORIES } from './ReportFinancialStatusTable';
import { ReportIntentionsTable } from './ReportIntentionsTable';
import { ReportLiabilitiesTable, DEFAULT_LIABILITY_CATEGORIES } from './ReportLiabilitiesTable';

interface ReportViewFullProps {
  report: Report;
  locationId: string;
  month: number;
  year: number;
}

interface AccountData {
  accountNumber: string;
  accountName: string;
  amount: number;
}

export const ReportViewFull: React.FC<ReportViewFullProps> = ({
  report,
  locationId,
  month,
  year
}) => {
  // Fetch transactions for the month
  const { data: transactionData, isLoading } = useQuery({
    queryKey: ['report-full-data', locationId, month, year],
    queryFn: async () => {
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

      // Fetch all transactions for the month
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          *,
          debit_account:accounts!transactions_debit_account_id_fkey(id, number, name),
          credit_account:accounts!transactions_credit_account_id_fkey(id, number, name)
        `)
        .eq('location_id', locationId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      // Process income accounts (credit side - 7xx, 2xx)
      const incomeAccounts = new Map<string, AccountData>();
      // Process expense accounts (debit side - 4xx, 2xx)
      const expenseAccounts = new Map<string, AccountData>();
      
      // Financial status data
      const financialStatus = new Map<string, {
        openingBalance: number;
        income: number;
        expense: number;
      }>();

      transactions?.forEach(tx => {
        // Income - credit side (7xx accounts, 2xx accounts for returns)
        if (tx.credit_account) {
          const accNum = tx.credit_account.number;
          const prefix = accNum.split('-')[0];
          const amount = tx.credit_amount || tx.amount || 0;
          
          if (prefix.startsWith('7') || prefix.startsWith('2')) {
            const key = prefix;
            const existing = incomeAccounts.get(key);
            if (existing) {
              existing.amount += amount;
            } else {
              incomeAccounts.set(key, {
                accountNumber: prefix,
                accountName: tx.credit_account.name,
                amount
              });
            }
          }

          // Track financial status for 1xx accounts
          if (prefix.startsWith('1')) {
            const existing = financialStatus.get(prefix) || { openingBalance: 0, income: 0, expense: 0 };
            existing.income += amount;
            financialStatus.set(prefix, existing);
          }
        }

        // Expenses - debit side (4xx accounts, 2xx accounts for payments)
        if (tx.debit_account) {
          const accNum = tx.debit_account.number;
          const prefix = accNum.split('-')[0];
          const amount = tx.debit_amount || tx.amount || 0;
          
          if (prefix.startsWith('4') || prefix.startsWith('2')) {
            const key = prefix;
            const existing = expenseAccounts.get(key);
            if (existing) {
              existing.amount += amount;
            } else {
              expenseAccounts.set(key, {
                accountNumber: prefix,
                accountName: tx.debit_account.name,
                amount
              });
            }
          }

          // Track financial status for 1xx accounts
          if (prefix.startsWith('1')) {
            const existing = financialStatus.get(prefix) || { openingBalance: 0, income: 0, expense: 0 };
            existing.expense += amount;
            financialStatus.set(prefix, existing);
          }
        }
      });

      // Calculate intentions data from account 210
      const intentions210Income = incomeAccounts.get('210')?.amount || 0;
      const intentions210Expense = expenseAccounts.get('210')?.amount || 0;

      return {
        incomeAccounts: Array.from(incomeAccounts.values()),
        expenseAccounts: Array.from(expenseAccounts.values()),
        totalIncome: Array.from(incomeAccounts.values()).reduce((sum, acc) => sum + acc.amount, 0),
        totalExpense: Array.from(expenseAccounts.values()).reduce((sum, acc) => sum + acc.amount, 0),
        financialStatus: Array.from(financialStatus.entries()).map(([prefix, data]) => ({
          prefix,
          ...data
        })),
        intentionsReceived: intentions210Income,
        intentionsCelebrated: intentions210Expense
      };
    },
    enabled: !!locationId && !!month && !!year
  });

  // Fetch opening balances
  const { data: openingBalances } = useQuery({
    queryKey: ['report-opening-balances', locationId, month, year],
    queryFn: async () => {
      // Get previous month's report for opening balances
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const { data: prevReport } = await supabase
        .from('reports')
        .select('id')
        .eq('location_id', locationId)
        .eq('month', prevMonth)
        .eq('year', prevYear)
        .single();

      if (prevReport) {
        const { data: prevDetails } = await supabase
          .from('report_details')
          .select('*')
          .eq('report_id', prevReport.id)
          .single();
        
        return {
          financialOpening: prevDetails?.closing_balance || 0,
          intentionsOpening: 0 // Would need to calculate from transactions
        };
      }

      return { financialOpening: 0, intentionsOpening: 0 };
    },
    enabled: !!locationId && !!month && !!year
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getMonthName = (m: number) => {
    const months = [
      'STYCZEŃ', 'LUTY', 'MARZEC', 'KWIECIEŃ', 'MAJ', 'CZERWIEC',
      'LIPIEC', 'SIERPIEŃ', 'WRZESIEŃ', 'PAŹDZIERNIK', 'LISTOPAD', 'GRUDZIEŃ'
    ];
    return months[m - 1] || '';
  };

  // Build financial status table data
  const financialStatusData = DEFAULT_CATEGORIES.map(category => {
    const matchingData = transactionData?.financialStatus.filter(fs => 
      category.accounts.some(acc => fs.prefix.startsWith(acc))
    ) || [];
    
    const income = matchingData.reduce((sum, d) => sum + d.income, 0);
    const expense = matchingData.reduce((sum, d) => sum + d.expense, 0);
    const openingBalance = 0; // Would need historical data
    const closingBalance = openingBalance + income - expense;

    return {
      name: category.name,
      openingBalance,
      income,
      expense,
      closingBalance
    };
  });

  // Build intentions table data
  const intentionsData = {
    openingBalance: openingBalances?.intentionsOpening || 0,
    celebratedAndGiven: transactionData?.intentionsCelebrated || 0,
    received: transactionData?.intentionsReceived || 0,
    closingBalance: (openingBalances?.intentionsOpening || 0) - (transactionData?.intentionsCelebrated || 0) + (transactionData?.intentionsReceived || 0)
  };

  // Build liabilities table data (placeholder)
  const liabilitiesData = DEFAULT_LIABILITY_CATEGORIES.map(category => ({
    name: category.name,
    receivablesOpening: 0,
    liabilitiesOpening: 0,
    receivablesChange: 0,
    liabilitiesChange: 0,
    receivablesClosing: 0,
    liabilitiesClosing: 0
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          SPRAWOZDANIE MIESIĘCZNE ZA OKRES: {getMonthName(month)} {year} r.
        </h2>
      </div>

      <Separator />

      {/* Section I - Income */}
      <Card>
        <CardContent className="pt-6">
          <ReportIncomeSection 
            accountsData={transactionData?.incomeAccounts || []}
            totalIncome={transactionData?.totalIncome || 0}
          />
        </CardContent>
      </Card>

      {/* Section II - Expenses */}
      <Card>
        <CardContent className="pt-6">
          <ReportExpenseSection 
            accountsData={transactionData?.expenseAccounts || []}
            totalExpense={transactionData?.totalExpense || 0}
          />
        </CardContent>
      </Card>

      {/* Section A - Financial Status */}
      <Card>
        <CardContent className="pt-6">
          <ReportFinancialStatusTable data={financialStatusData} />
        </CardContent>
      </Card>

      {/* Section B - Intentions */}
      <Card>
        <CardContent className="pt-6">
          <ReportIntentionsTable data={intentionsData} />
        </CardContent>
      </Card>

      {/* Section D - Liabilities (skip C - Towary) */}
      <Card>
        <CardContent className="pt-6">
          <ReportLiabilitiesTable data={liabilitiesData} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportViewFull;
