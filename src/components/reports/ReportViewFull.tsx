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
import { fetchAllRows } from '@/utils/supabasePagination';
import { matchesAccount } from '@/utils/liabilityMatching';

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
  // Pobierz identyfikator placówki (np. "2-15") aby filtrować transakcje
  // na podstawie numerów kont (segmenty 2-3), a nie tylko po location_id transakcji.
  // To kluczowe: transakcje utworzone przez Prowincję, dotyczące kont domu (np.
  // PROW/2026/02/084 z kontami 201-2-13-*), muszą być uwzględnione w raporcie
  // tego domu — Account Search pokazuje je poprawnie, raport miesięczny pomijał.
  const { data: homeAccounts } = useQuery({
    queryKey: ['report-home-account-ids', locationId],
    enabled: !!locationId,
    queryFn: async () => {
      // 1. Pobierz location_identifier placówki
      const { data: loc, error: locErr } = await supabase
        .from('locations')
        .select('location_identifier')
        .eq('id', locationId)
        .maybeSingle();
      if (locErr) throw locErr;
      const identifier = loc?.location_identifier;
      if (!identifier) return { ids: [] as string[], numbers: new Set<string>() };

      // 2. Pobierz kandydatów wzorcem LIKE, a następnie ścisłe dopasowanie po segmentach,
      //    by uniknąć kolizji typu identifier="2-10" łapiącego konta "459-4-2-10" lub
      //    "217-4-2-10-1-1" należące do innej placówki (4-2).
      const pattern = `%-${identifier}`;
      const patternSub = `%-${identifier}-%`;
      const accs = await fetchAllRows<{ id: string; number: string }>((from, to) =>
        supabase
          .from('accounts')
          .select('id, number')
          .or(`number.like.${pattern},number.like.${patternSub}`)
          .range(from, to)
      );
      const idParts = identifier.split('-');
      const seg1 = idParts[0];
      const seg2 = idParts[1]; // może być undefined dla jednoczłonowych (Prowincja "1")
      const matches = accs.filter((a) => {
        const p = a.number.split('-');
        if (seg2 === undefined) {
          // jednoczłonowy identyfikator (np. "1") – segment 2 konta = identifier,
          // a konto nie powinno mieć kolejnego segmentu placówki domowej
          return p[1] === seg1;
        }
        return p[1] === seg1 && p[2] === seg2;
      });
      return {
        ids: matches.map((a) => a.id),
        numbers: new Set<string>(matches.map((a) => a.number)),
      };
    },
  });
  const homeAccountIds = homeAccounts?.ids;
  const homeAccountNumbers = homeAccounts?.numbers;

  // Helper – pobiera wszystkie transakcje, których któraś strona dotyczy podanych kont.
  // Dzieli IDs na paczki po 300 by nie przekroczyć limitu długości URL PostgREST
  // i wykonuje dwa równoległe zapytania (debit / credit) z paginacją.
  const fetchTransactionsForAccounts = async (
    accountIds: string[],
    selectClause: string,
    extraFilter?: (q: any) => any,
  ): Promise<any[]> => {
    if (!accountIds || accountIds.length === 0) return [];
    const CHUNK = 300;
    const chunks: string[][] = [];
    for (let i = 0; i < accountIds.length; i += CHUNK) {
      chunks.push(accountIds.slice(i, i + CHUNK));
    }
    const fetchSide = async (side: 'debit_account_id' | 'credit_account_id') => {
      const all: any[] = [];
      for (const ids of chunks) {
        const part = await fetchAllRows<any>((from, to) => {
          let q: any = supabase.from('transactions').select(selectClause).in(side, ids);
          if (extraFilter) q = extraFilter(q);
          return q.order('date', { ascending: true }).range(from, to);
        });
        all.push(...part);
      }
      return all;
    };
    const [d, c] = await Promise.all([fetchSide('debit_account_id'), fetchSide('credit_account_id')]);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const tx of [...d, ...c]) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        out.push(tx);
      }
    }
    return out;
  };

  // Fetch liability category mappings (prefer per-location, fallback to global NULL)
  const { data: liabilityMappings } = useQuery({
    queryKey: ['report-liability-mappings', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_liability_category_mappings')
        .select('category_key, account_prefixes, location_id, display_order')
        .or(`location_id.eq.${locationId},location_id.is.null`);
      if (error) throw error;
      // Per-location overrides global; key by category_key
      const byKey = new Map<string, string[]>();
      const order: Record<string, number> = {};
      // First pass: globals
      (data || []).filter((r: any) => !r.location_id).forEach((r: any) => {
        byKey.set(r.category_key, r.account_prefixes || []);
        order[r.category_key] = r.display_order || 0;
      });
      // Second pass: per-location overrides
      (data || []).filter((r: any) => r.location_id === locationId).forEach((r: any) => {
        byKey.set(r.category_key, r.account_prefixes || []);
        order[r.category_key] = r.display_order || 0;
      });
      return { byKey, order };
    },
    enabled: !!locationId,
  });

  // Nazwy kont są teraz zahardcodowane w komponentach ReportIncomeSection i ReportExpenseSection
  // Nie ma potrzeby pobierania ich z bazy danych

  // Fetch opening balances from ALL transactions BEFORE this month
  const { data: openingBalances } = useQuery({
    queryKey: ['report-opening-balances-calculated-v4-byacc', locationId, month, year, homeAccountIds?.length || 0],
    enabled: !!locationId && !!month && !!year && !!homeAccountIds,
    queryFn: async () => {
      // Calculate end of previous month
      const prevMonthEnd = month === 1 
        ? new Date(year - 1, 11, 31) 
        : new Date(year, month - 1, 0);
      const prevMonthEndStr = formatDateForDB(prevMonthEnd);

      console.log('📅 Obliczam saldo otwarcia na podstawie transakcji do:', prevMonthEndStr);

      // Helper do przeliczania kwot walutowych na PLN
      const getAmountInPLN = (amount: number, currency?: string, exchangeRate?: number): number => {
        if (!currency || currency === 'PLN' || !exchangeRate || exchangeRate === 1) return amount;
        return amount * exchangeRate;
      };

      // Pobierz transakcje dotyczące kont domu (niezależnie od location_id transakcji)
      const allTransactions = await fetchTransactionsForAccounts(
        homeAccountIds || [],
        `id, debit_amount, credit_amount, currency, exchange_rate,
         debit_account:accounts!transactions_debit_account_id_fkey(number),
         credit_account:accounts!transactions_credit_account_id_fkey(number)`,
        (q) => q.lte('date', prevMonthEndStr),
      );
      console.log('📊 Pobrano transakcji do salda otwarcia:', allTransactions.length);

      // Calculate cumulative balances per FULL account number AND per first-segment prefix.
      // - balances (Map<prefix,number>) keeps backward-compat for 1xx grouping.
      // - balancesByAccount (Map<fullNumber,number>) lets liability mappings sum specific analytics.
      const balances = new Map<string, number>();
      const balancesByAccount = new Map<string, number>();
      
      allTransactions?.forEach(tx => {
        const rate = tx.exchange_rate || 1;
        const curr = tx.currency || 'PLN';
        
        // Debit side (Wn) - increases balance
        if (tx.debit_account?.number && homeAccountNumbers?.has(tx.debit_account.number)) {
          const fullNum = tx.debit_account.number;
          const prefix = fullNum.split('-')[0];
          const rawAmount = tx.debit_amount || 0;
          const amount = getAmountInPLN(rawAmount, curr, rate);
          balances.set(prefix, (balances.get(prefix) || 0) + amount);
          balancesByAccount.set(fullNum, (balancesByAccount.get(fullNum) || 0) + amount);
        }
        
        // Credit side (Ma) - decreases balance
        if (tx.credit_account?.number && homeAccountNumbers?.has(tx.credit_account.number)) {
          const fullNum = tx.credit_account.number;
          const prefix = fullNum.split('-')[0];
          const rawAmount = tx.credit_amount || 0;
          const amount = getAmountInPLN(rawAmount, curr, rate);
          balances.set(prefix, (balances.get(prefix) || 0) - amount);
          balancesByAccount.set(fullNum, (balancesByAccount.get(fullNum) || 0) - amount);
        }
      });

      console.log('💰 Obliczone salda otwarcia:', Object.fromEntries(balances));

      return { balances, balancesByAccount };
    },
  });

  // Fetch transactions for the CURRENT month only
  const { data: transactionData, isLoading } = useQuery({
    queryKey: ['report-full-data-v4-byacc', locationId, month, year, homeAccountIds?.length || 0],
    enabled: !!locationId && !!month && !!year && !!homeAccountIds,
    queryFn: async () => {
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      const dateFrom = getFirstDayOfMonth(year, month);
      const dateTo = getLastDayOfMonth(year, month);

      console.log('📅 Pobieram transakcje TYLKO za okres:', dateFrom, '-', dateTo);

      // Pobierz transakcje miesiąca dotyczące kont domu (niezależnie od location_id transakcji)
      const transactions = await fetchTransactionsForAccounts(
        homeAccountIds || [],
        `*,
         debit_account:accounts!transactions_debit_account_id_fkey(id, number, name),
         credit_account:accounts!transactions_credit_account_id_fkey(id, number, name)`,
        (q) => q.gte('date', dateFrom).lte('date', dateTo),
      );

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
      // Per FULL account number aggregation for liabilities (used by category mappings)
      const liabilitiesByAccount = new Map<string, {
        receivables: number;
        liabilities: number;
      }>();

      // Intentions data (account 210) – konto pasywne
      // Strona Ma 210 = przyjęcie intencji (powstanie zobowiązania)
      // Strona Wn 210 = odprawienie/oddanie intencji (zmniejszenie zobowiązania)
      let intentions210Received = 0; // Ma - przyjęte
      let intentions210CelebratedGiven = 0; // Wn - odprawione i oddane

      // Helper do przeliczania kwot walutowych na PLN
      const getAmountInPLN = (amount: number, currency?: string, exchangeRate?: number): number => {
        if (!currency || currency === 'PLN' || !exchangeRate || exchangeRate === 1) return amount;
        return amount * exchangeRate;
      };

      transactions?.forEach(tx => {
        const rate = tx.exchange_rate || 1;
        const curr = tx.currency || 'PLN';

        // Credit side processing
        if (tx.credit_account && homeAccountNumbers?.has(tx.credit_account.number)) {
          const accNum = tx.credit_account.number;
          const prefix = accNum.split('-')[0];
          const rawAmount = tx.credit_amount || tx.amount || 0;
          const amount = getAmountInPLN(rawAmount, curr, rate);
          
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
            const fullNum = accNum;
            const ex2 = liabilitiesByAccount.get(fullNum) || { receivables: 0, liabilities: 0 };
            ex2.liabilities += amount;
            liabilitiesByAccount.set(fullNum, ex2);
          }

          // Intentions 210 (Ma = przyjęte – konto pasywne)
          if (prefix === '210') {
            intentions210Received += amount;
          }
        }

        // Debit side processing
        if (tx.debit_account && homeAccountNumbers?.has(tx.debit_account.number)) {
          const accNum = tx.debit_account.number;
          const prefix = accNum.split('-')[0];
          const rawAmount = tx.debit_amount || tx.amount || 0;
          const amount = getAmountInPLN(rawAmount, curr, rate);
          
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
            const fullNum = accNum;
            const ex2 = liabilitiesByAccount.get(fullNum) || { receivables: 0, liabilities: 0 };
            ex2.receivables += amount;
            liabilitiesByAccount.set(fullNum, ex2);
          }

          // Intentions 210 (Wn = odprawione i oddane – konto pasywne)
          if (prefix === '210') {
            intentions210CelebratedGiven += amount;
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
        liabilitiesByAccount: Array.from(liabilitiesByAccount.entries()).map(([accountNumber, data]) => ({
          accountNumber,
          ...data
        })),
        intentionsReceived: intentions210Received,
        intentionsCelebrated: intentions210CelebratedGiven
      };
    },
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
    const { balances, balancesByAccount } = openingBalances;
    let total = 0;
    if (accounts.length === 0) return 0;
    const hasHyphen = accounts.some((a) => a.includes('-'));
    if (hasHyphen) {
      // Per FULL account-number matching (supports exact and wildcard "-*")
      balancesByAccount.forEach((balance, accNum) => {
        if (accounts.some((acc) => matchesAccount(accNum, acc))) total += balance;
      });
    } else {
      // Single-segment prefixes → aggregate first-segment prefix
      balances.forEach((balance, prefix) => {
        if (accounts.includes(prefix)) total += balance;
      });
    }
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
  // Konto 210 jest kontem pasywnym – saldo otwarcia liczone jako (Ma − Wn).
  const intentionsOpeningBalance = -(openingBalances?.balances.get('210') || 0);

  // Build intentions table data
  const intentionsData = {
    openingBalance: intentionsOpeningBalance,
    celebratedAndGiven: transactionData?.intentionsCelebrated || 0, // Ma
    received: transactionData?.intentionsReceived || 0, // Wn
    closingBalance: intentionsOpeningBalance + (transactionData?.intentionsReceived || 0) - (transactionData?.intentionsCelebrated || 0)
  };

  // Build liabilities table data — uses configurable mappings per location (with global fallback)
  const liabilitiesTableData = DEFAULT_LIABILITY_CATEGORIES.map(category => {
    const mapped = liabilityMappings?.byKey.get(category.key);
    const accountsForCategory = mapped && mapped.length > 0 ? mapped : category.accounts;

    if (accountsForCategory.length === 0) {
      const openingBalance = 0;
      return {
        name: category.name,
        openingBalance,
        receivables: 0,
        liabilities: 0,
        closingBalance: 0,
      };
    }

    const isSpecific = accountsForCategory.some(a => a.includes('-'));

    let receivables = 0;
    let liabilities = 0;
    if (isSpecific) {
      // Aggregate by FULL account number against mapped prefixes
      (transactionData?.liabilitiesByAccount || []).forEach(ld => {
        if (accountsForCategory.some(acc => matchesAccount(ld.accountNumber, acc))) {
          receivables += ld.receivables;
          liabilities += ld.liabilities;
        }
      });
    } else {
      // Single-segment prefixes → aggregate by first-segment prefix
      (transactionData?.liabilitiesData || []).forEach(ld => {
        if (accountsForCategory.some(acc => ld.prefix === acc || ld.prefix.startsWith(acc))) {
          receivables += ld.receivables;
          liabilities += ld.liabilities;
        }
      });
    }

    const openingBalance = getCategoryOpeningBalance(accountsForCategory);
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
