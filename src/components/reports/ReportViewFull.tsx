 import React from 'react';
 import { formatDateForDB, getFirstDayOfMonth, getLastDayOfMonth } from '@/utils/dateUtils';
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
  // Nazwy kont są teraz zahardcodowane w komponentach ReportIncomeSection i ReportExpenseSection
  // Nie ma potrzeby pobierania ich z bazy danych

  // Fetch opening balances from ALL transactions BEFORE this month
  const { data: openingBalances } = useQuery({
    queryKey: ['report-opening-balances-calculated', locationId, month, year],
    queryFn: async () => {
      // Calculate end of previous month
      const prevMonthEnd = month === 1 
        ? new Date(year - 1, 11, 31) 
        : new Date(year, month - 1, 0);
      const prevMonthEndStr = formatDateForDB(prevMonthEnd);

      console.log('📅 Obliczam saldo otwarcia na podstawie transakcji do:', prevMonthEndStr);

      // Fetch ALL transactions up to end of previous month
      const { data: allTransactions, error } = await supabase
        .from('transactions')
        .select(`
          debit_amount, credit_amount,
          debit_account:accounts!transactions_debit_account_id_fkey(number),
          credit_account:accounts!transactions_credit_account_id_fkey(number)
        `)
        .eq('location_id', locationId)
        .lte('date', prevMonthEndStr);

      if (error) throw error;

      // Calculate cumulative balances for each account prefix
      // For 1xx accounts: balance = sum(Wn) - sum(Ma)
      // For 2xx accounts: balance = sum(Wn) - sum(Ma)
      const balances = new Map<string, number>();
      
      allTransactions?.forEach(tx => {
        // Debit side (Wn) - increases balance
        if (tx.debit_account?.number) {
          const prefix = tx.debit_account.number.split('-')[0];
          const amount = tx.debit_amount || 0;
          balances.set(prefix, (balances.get(prefix) || 0) + amount);
        }
        
        // Credit side (Ma) - decreases balance
        if (tx.credit_account?.number) {
          const prefix = tx.credit_account.number.split('-')[0];
          const amount = tx.credit_amount || 0;
          balances.set(prefix, (balances.get(prefix) || 0) - amount);
        }
      });

      console.log('💰 Obliczone salda otwarcia:', Object.fromEntries(balances));

      return balances;
    },
    enabled: !!locationId && !!month && !!year
  });

  // Fetch transactions for the CURRENT month only
  const { data: transactionData, isLoading } = useQuery({
    queryKey: ['report-full-data', locationId, month, year],
    queryFn: async () => {
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      const dateFrom = getFirstDayOfMonth(year, month);
      const dateTo = getLastDayOfMonth(year, month);

      console.log('📅 Pobieram transakcje TYLKO za okres:', dateFrom, '-', dateTo);

      // Fetch all transactions for the month ONLY
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

      console.log('📊 Pobrano transakcji za bieżący miesiąc:', transactions?.length);

      // Process income accounts (credit side - only 7xx)
      const incomeAccounts = new Map<string, AccountData>();
      // Process expense accounts (debit side - only 4xx)
      const expenseAccounts = new Map<string, AccountData>();
      
      // Financial status data (1xx accounts) with debits and credits
      const financialStatus = new Map<string, {
        debits: number;  // Uznania (Wn)
        credits: number; // Obciążenia (Ma)
      }>();

      // Liabilities data (2xx accounts) with receivables and liabilities
      const liabilitiesData = new Map<string, {
        receivables: number;  // Należności (Wn)
        liabilities: number;  // Zobowiązania (Ma)
      }>();

      // Intentions data (account 210)
      let intentions210Received = 0; // Wn - przyjęte
      let intentions210CelebratedGiven = 0; // Ma - odprawione i oddane

      transactions?.forEach(tx => {
        // Credit side processing
        if (tx.credit_account) {
          const accNum = tx.credit_account.number;
          const prefix = accNum.split('-')[0];
          const amount = tx.credit_amount || tx.amount || 0;
          
          // Income - only 7xx accounts
          if (prefix.startsWith('7')) {
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

          // Track financial status for 1xx accounts (Ma = Obciążenia)
          if (prefix.startsWith('1')) {
            const existing = financialStatus.get(prefix) || { debits: 0, credits: 0 };
            existing.credits += amount;
            financialStatus.set(prefix, existing);
          }

          // Track liabilities for 2xx accounts (Ma = Zobowiązania)
          if (prefix.startsWith('2')) {
            const existing = liabilitiesData.get(prefix) || { receivables: 0, liabilities: 0 };
            existing.liabilities += amount;
            liabilitiesData.set(prefix, existing);
          }

          // Intentions 210 (Ma = odprawione i oddane)
          if (prefix === '210') {
            intentions210CelebratedGiven += amount;
          }
        }

        // Debit side processing
        if (tx.debit_account) {
          const accNum = tx.debit_account.number;
          const prefix = accNum.split('-')[0];
          const amount = tx.debit_amount || tx.amount || 0;
          
          // Expenses - only 4xx accounts
          if (prefix.startsWith('4')) {
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

          // Track financial status for 1xx accounts (Wn = Uznania)
          if (prefix.startsWith('1')) {
            const existing = financialStatus.get(prefix) || { debits: 0, credits: 0 };
            existing.debits += amount;
            financialStatus.set(prefix, existing);
          }

          // Track liabilities for 2xx accounts (Wn = Należności)
          if (prefix.startsWith('2')) {
            const existing = liabilitiesData.get(prefix) || { receivables: 0, liabilities: 0 };
            existing.receivables += amount;
            liabilitiesData.set(prefix, existing);
          }

          // Intentions 210 (Wn = przyjęte)
          if (prefix === '210') {
            intentions210Received += amount;
          }
        }
      });

      return {
        incomeAccounts: Array.from(incomeAccounts.values()),
        expenseAccounts: Array.from(expenseAccounts.values()),
        totalIncome: Array.from(incomeAccounts.values()).reduce((sum, acc) => sum + acc.amount, 0),
        totalExpense: Array.from(expenseAccounts.values()).reduce((sum, acc) => sum + acc.amount, 0),
        financialStatus: Array.from(financialStatus.entries()).map(([prefix, data]) => ({
          prefix,
          ...data
        })),
        liabilitiesData: Array.from(liabilitiesData.entries()).map(([prefix, data]) => ({
          prefix,
          ...data
        })),
        intentionsReceived: intentions210Received,
        intentionsCelebrated: intentions210CelebratedGiven
      };
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

  // Helper function to get opening balance for a category
  const getCategoryOpeningBalance = (accounts: string[]): number => {
    if (!openingBalances) return 0;
    let total = 0;
    accounts.forEach(acc => {
      // Check all prefixes that start with this account number
      openingBalances.forEach((balance, prefix) => {
        if (prefix.startsWith(acc)) {
          total += balance;
        }
      });
    });
    return total;
  };

  // Build financial status table data with new structure
  const financialStatusData = DEFAULT_CATEGORIES.map(category => {
    const matchingData = transactionData?.financialStatus.filter(fs => 
      category.accounts.some(acc => fs.prefix.startsWith(acc))
    ) || [];
    
    const debits = matchingData.reduce((sum, d) => sum + d.debits, 0);
    const credits = matchingData.reduce((sum, d) => sum + d.credits, 0);
    const openingBalance = getCategoryOpeningBalance(category.accounts);
    // Wzór: początek + uznania - obciążenia
    const closingBalance = openingBalance + debits - credits;

    return {
      name: category.name,
      openingBalance,
      debits,
      credits,
      closingBalance
    };
  });

  // Calculate intentions opening balance from previous transactions
  const intentionsOpeningBalance = openingBalances?.get('210') || 0;

  // Build intentions table data
  const intentionsData = {
    openingBalance: intentionsOpeningBalance,
    celebratedAndGiven: transactionData?.intentionsCelebrated || 0, // Ma
    received: transactionData?.intentionsReceived || 0, // Wn
    closingBalance: intentionsOpeningBalance + (transactionData?.intentionsReceived || 0) - (transactionData?.intentionsCelebrated || 0)
  };

  // Build liabilities table data with new structure
  const liabilitiesTableData = DEFAULT_LIABILITY_CATEGORIES.map(category => {
    const matchingData = transactionData?.liabilitiesData?.filter(ld => 
      category.accounts.some(acc => ld.prefix.startsWith(acc))
    ) || [];
    
    const receivables = matchingData.reduce((sum, d) => sum + d.receivables, 0);
    const liabilities = matchingData.reduce((sum, d) => sum + d.liabilities, 0);
    const openingBalance = getCategoryOpeningBalance(category.accounts);
    // Wzór: początek + należności - zobowiązania
    const closingBalance = openingBalance + receivables - liabilities;

    return {
      name: category.name,
      openingBalance,
      receivables,
      liabilities,
      closingBalance
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          SPRAWOZDANIE MIESIĘCZNE ZA OKRES: {getMonthName(month)} {year} r.
        </h2>
      </div>

      <Separator />

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
          <ReportLiabilitiesTable data={liabilitiesTableData} />
        </CardContent>
      </Card>

      <Separator />

      {/* Section I - Income - hardcoded account names */}
      <Card>
        <CardContent className="pt-6">
          <ReportIncomeSection 
            accountsData={transactionData?.incomeAccounts || []}
            totalIncome={transactionData?.totalIncome || 0}
          />
        </CardContent>
      </Card>

      {/* Section II - Expenses - hardcoded account names */}
      <Card>
        <CardContent className="pt-6">
          <ReportExpenseSection 
            accountsData={transactionData?.expenseAccounts || []}
            totalExpense={transactionData?.totalExpense || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportViewFull;
