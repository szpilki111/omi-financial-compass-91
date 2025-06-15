
import { KpirTransaction } from "@/types/kpir";
import { supabase } from "@/integrations/supabase/client";

/**
 * Funkcja diagnostyczna - sprawdza integralność danych kont w transakcjach
 */
export const diagnoseDatabaseAccountIntegrity = async (
  locationId: string | null | undefined,
  dateFrom?: string,
  dateTo?: string
) => {
  try {
    console.log('🔍 ROZPOCZYNAM DIAGNOSTYKĘ INTEGRALNOŚCI KONT');
    console.log('='.repeat(80));

    // Pobierz transakcje z określonymi filtrami
    let query = supabase
      .from('transactions')
      .select('id, debit_account_id, credit_account_id, amount, description, document_number')
      .order('date', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data: transactions, error: transError } = await query;
    if (transError) throw transError;

    console.log(`📊 Znaleziono ${transactions?.length || 0} transakcji`);

    // Pobierz wszystkie konta
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('id, number, name');
    if (accError) throw accError;

    console.log(`📊 Znaleziono ${accounts?.length || 0} kont w bazie`);

    // Utwórz zbiory ID kont
    const accountIds = new Set(accounts.map(acc => acc.id));
    const allDebitIds = new Set(transactions?.map(t => t.debit_account_id) || []);
    const allCreditIds = new Set(transactions?.map(t => t.credit_account_id) || []);

    // Znajdź brakujące konta
    const missingDebitIds = [...allDebitIds].filter(id => !accountIds.has(id));
    const missingCreditIds = [...allCreditIds].filter(id => !accountIds.has(id));

    console.log('\n🚨 ANALIZA BRAKUJĄCYCH KONT:');
    console.log(`Brakujące konta WN: ${missingDebitIds.length}`);
    console.log(`Brakujące konta MA: ${missingCreditIds.length}`);

    if (missingDebitIds.length > 0) {
      console.log('\n❌ BRAKUJĄCE KONTA WN (debit):');
      missingDebitIds.forEach(id => {
        const affectedTransactions = transactions?.filter(t => t.debit_account_id === id) || [];
        console.log(`  ID: ${id} (wpływa na ${affectedTransactions.length} transakcji)`);
        affectedTransactions.slice(0, 3).forEach(t => {
          console.log(`    - Transakcja: ${t.document_number} - ${t.description} (${t.amount} zł)`);
        });
      });
    }

    if (missingCreditIds.length > 0) {
      console.log('\n❌ BRAKUJĄCE KONTA MA (credit):');
      missingCreditIds.forEach(id => {
        const affectedTransactions = transactions?.filter(t => t.credit_account_id === id) || [];
        console.log(`  ID: ${id} (wpływa na ${affectedTransactions.length} transakcji)`);
        affectedTransactions.slice(0, 3).forEach(t => {
          console.log(`    - Transakcja: ${t.document_number} - ${t.description} (${t.amount} zł)`);
        });
      });
    }

    // Sprawdź czy są duplikaty numerów kont
    const accountNumbers = accounts.map(acc => acc.number);
    const duplicateNumbers = accountNumbers.filter((num, index) => accountNumbers.indexOf(num) !== index);
    
    if (duplicateNumbers.length > 0) {
      console.log('\n⚠️ DUPLIKATY NUMERÓW KONT:');
      duplicateNumbers.forEach(num => {
        const duplicates = accounts.filter(acc => acc.number === num);
        console.log(`  Numer ${num}:`);
        duplicates.forEach(acc => console.log(`    - ID: ${acc.id}, Nazwa: ${acc.name}`));
      });
    }

    // Sprawdź konta przychodowe (7xx) w transakcjach
    const incomeAccountsUsed = accounts.filter(acc => 
      acc.number.startsWith('7') && 
      (allDebitIds.has(acc.id) || allCreditIds.has(acc.id))
    );

    console.log('\n💰 KONTA PRZYCHODOWE (7xx) UŻYWANE W TRANSAKCJACH:');
    incomeAccountsUsed.forEach(acc => {
      const debitTransactions = transactions?.filter(t => t.debit_account_id === acc.id) || [];
      const creditTransactions = transactions?.filter(t => t.credit_account_id === acc.id) || [];
      
      console.log(`  ${acc.number} - ${acc.name}:`);
      console.log(`    WN (debet): ${debitTransactions.length} transakcji`);
      console.log(`    MA (kredyt): ${creditTransactions.length} transakcji`);
      
      // Pokaż przykłady transakcji kredytowych (powinny być przychodami)
      if (creditTransactions.length > 0) {
        console.log(`    Przykłady MA (przychody):`);
        creditTransactions.slice(0, 2).forEach(t => {
          console.log(`      - ${t.document_number}: ${t.amount} zł - ${t.description}`);
        });
      }
    });

    return {
      totalTransactions: transactions?.length || 0,
      totalAccounts: accounts?.length || 0,
      missingDebitAccounts: missingDebitIds.length,
      missingCreditAccounts: missingCreditIds.length,
      duplicateNumbers: duplicateNumbers.length,
      incomeAccountsCount: incomeAccountsUsed.length
    };

  } catch (error) {
    console.error('❌ Błąd podczas diagnostyki:', error);
    return null;
  }
};

/**
 * Oblicza podsumowanie finansowe na podstawie transakcji dla określonej lokalizacji i okresu
 * Z rozszerzonymi informacjami o kontach
 */
export const calculateFinancialSummary = async (
  locationId: string | null | undefined,
  dateFrom?: string,
  dateTo?: string
) => {
  try {
    let query = supabase
      .from('transactions')
      .select(`
        id,
        date,
        document_number,
        description,
        amount,
        debit_account_id,
        credit_account_id,
        settlement_type,
        currency,
        exchange_rate,
        location_id,
        debit_amount,
        credit_amount
      `)
      .order('date', { ascending: false });

    // Filtr po lokalizacji
    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    // Zastosuj filtr daty od
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    
    // Zastosuj filtr daty do
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Pobierz konta TYLKO przypisane do lokalizacji
    let accountsQuery = supabase
      .from('accounts')
      .select(`
        id, 
        number, 
        name,
        location_accounts!inner(location_id)
      `);

    // Jeśli mamy lokalizację, filtruj konta tylko dla tej lokalizacji
    if (locationId) {
      accountsQuery = accountsQuery.eq('location_accounts.location_id', locationId);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) {
      throw accountsError;
    }

    const accountsMap = new Map(accounts.map((acc: any) => [acc.id, { number: acc.number, name: acc.name }]));

    const formattedTransactions: KpirTransaction[] = data.map((transaction: any) => {
      const debitAccount = accountsMap.get(transaction.debit_account_id);
      const creditAccount = accountsMap.get(transaction.credit_account_id);
      
      return {
        ...transaction,
        debitAccount: debitAccount || { number: 'Nieznane', name: 'Nieznane konto' },
        creditAccount: creditAccount || { number: 'Nieznane', name: 'Nieznane konto' },
        formattedDate: new Date(transaction.date).toLocaleDateString('pl-PL'),
        settlement_type: transaction.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek'
      };
    });

    // Funkcje do sprawdzania kont na podstawie pierwszej cyfry + konto 200
    const isIncomeAccount = (accountNum: string) => {
      if (!accountNum || accountNum === 'Nieznane') return false;
      return accountNum.startsWith('7') || accountNum === '200';
    };

    const isExpenseAccount = (accountNum: string) => {
      if (!accountNum || accountNum === 'Nieznane') return false;
      return accountNum.startsWith('4') || accountNum === '200';
    };

    let income = 0;
    let expense = 0;
    const accountBreakdown: Record<string, { 
      account_id: string; 
      account_number: string; 
      account_name: string; 
      income: number; 
      expense: number; 
    }> = {};

    if (!formattedTransactions || formattedTransactions.length === 0) {
      return { income: 0, expense: 0, balance: 0, transactions: [], accountBreakdown: [] };
    }

    // Analiza każdej transakcji
    formattedTransactions.forEach(transaction => {
      const debitAccountNumber = transaction.debitAccount?.number || '';
      const creditAccountNumber = transaction.creditAccount?.number || '';

      let transactionIncome = 0;
      let transactionExpense = 0;

      // Sprawdź czy konto kredytowe (MA) to konto przychodowe (7xx lub 200)
      const creditIsIncome = isIncomeAccount(creditAccountNumber);

      // Sprawdź czy konto debetowe (WN) to konto kosztowe (4xx lub 200)  
      const debitIsExpense = isExpenseAccount(debitAccountNumber);

      // PRZYCHODY: konto 7xx lub 200 po stronie kredytu (MA)
      if (creditIsIncome) {
        // Użyj credit_amount jeśli jest > 0, w przeciwnym razie użyj amount
        if (transaction.credit_amount != null && transaction.credit_amount > 0) {
          transactionIncome = transaction.credit_amount;
        } else {
          transactionIncome = transaction.amount;
        }

        // Dodaj do breakdown przychodów
        const accountKey = `${transaction.credit_account_id}_income`;
        if (!accountBreakdown[accountKey]) {
          accountBreakdown[accountKey] = {
            account_id: transaction.credit_account_id,
            account_number: creditAccountNumber,
            account_name: transaction.creditAccount?.name || 'Nieznane konto',
            income: 0,
            expense: 0
          };
        }
        accountBreakdown[accountKey].income += transactionIncome;
      }

      // KOSZTY: konto 4xx lub 200 po stronie debetu (WN)
      if (debitIsExpense) {
        // Użyj debit_amount jeśli jest > 0, w przeciwnym razie użyj amount
        if (transaction.debit_amount != null && transaction.debit_amount > 0) {
          transactionExpense = transaction.debit_amount;
        } else {
          transactionExpense = transaction.amount;
        }

        // Dodaj do breakdown kosztów
        const accountKey = `${transaction.debit_account_id}_expense`;
        if (!accountBreakdown[accountKey]) {
          accountBreakdown[accountKey] = {
            account_id: transaction.debit_account_id,
            account_number: debitAccountNumber,
            account_name: transaction.debitAccount?.name || 'Nieznane konto',
            income: 0,
            expense: 0
          };
        }
        accountBreakdown[accountKey].expense += transactionExpense;
      }

      // Dodaj do sum całkowitych
      income += transactionIncome;
      expense += transactionExpense;
    });

    const balance = income - expense;

    return {
      income,
      expense,
      balance,
      transactions: formattedTransactions,
      accountBreakdown: Object.values(accountBreakdown)
    };
  } catch (error) {
    console.error('Błąd podczas obliczania podsumowania finansowego:', error);
    return { income: 0, expense: 0, balance: 0, transactions: [], accountBreakdown: [] };
  }
};

/**
 * Oblicza saldo zamknięcia dla poprzedniego okresu
 */
export const calculatePreviousPeriodClosingBalance = async (
  locationId: string,
  year: number,
  month?: number
) => {
  try {
    let prevYear = year;
    let prevMonth = month;

    if (month) {
      // Dla raportu miesięcznego - poprzedni miesiąc
      if (month === 1) {
        prevYear = year - 1;
        prevMonth = 12;
      } else {
        prevMonth = month - 1;
      }
    } else {
      // Dla raportu rocznego - poprzedni rok
      prevYear = year - 1;
    }

    console.log(`Szukam saldo zamknięcia dla: ${prevYear}${prevMonth ? `/${prevMonth}` : ''}`);

    // Szukaj raportu z poprzedniego okresu
    let query = supabase
      .from('reports')
      .select('id, report_details(closing_balance)')
      .eq('location_id', locationId)
      .eq('year', prevYear);

    if (prevMonth) {
      query = query.eq('month', prevMonth).eq('report_type', 'monthly');
    } else {
      query = query.eq('report_type', 'annual');
    }

    const { data: prevReports, error } = await query.single();

    if (error || !prevReports?.report_details?.closing_balance) {
      console.log('Nie znaleziono poprzedniego raportu lub saldo zamknięcia');
      return 0;
    }

    return Number(prevReports.report_details.closing_balance) || 0;
  } catch (error) {
    console.error('Błąd podczas pobierania poprzedniego saldo:', error);
    return 0;
  }
};

/**
 * Pobierz szczegóły finansowe dla konkretnego raportu
 * Ta funkcja zwraca zapisane wartości z tabeli report_details lub zerowe wartości jeśli nie ma zapisanych danych
 */
export const getReportFinancialDetails = async (reportId: string) => {
  try {
    console.log(`Pobieranie szczegółów finansowych dla raportu: ${reportId}`);
    
    // Pobierz istniejące szczegóły z tabeli report_details
    const { data: reportDetails, error: reportDetailsError } = await supabase
      .from('report_details')
      .select('*')
      .eq('report_id', reportId)
      .maybeSingle();
    
    if (reportDetailsError) {
      console.error('Błąd podczas pobierania szczegółów raportu:', reportDetailsError);
      return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0, closingBalance: 0 };
    }
    
    if (!reportDetails) {
      console.log('Nie znaleziono szczegółów raportu w report_details, zwracam zerowe wartości');
      return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0, closingBalance: 0 };
    }
    
    // Jeśli znaleziono szczegóły, zwróć je
    return {
      income: Number(reportDetails.income_total) || 0,
      expense: Number(reportDetails.expense_total) || 0,
      balance: Number(reportDetails.balance) || 0,
      settlements: Number(reportDetails.settlements_total) || 0,
      openingBalance: Number(reportDetails.opening_balance) || 0,
      closingBalance: Number(reportDetails.closing_balance) || 0
    };
  } catch (error) {
    console.error('Błąd podczas pobierania szczegółów finansowych raportu:', error);
    return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0, closingBalance: 0 };
  }
};

/**
 * Aktualizuje szczegóły finansowe raportu wraz z saldem początkowym i końcowym
 */
export const updateReportDetails = async (
  reportId: string, 
  financialSummary: { 
    income: number; 
    expense: number; 
    balance: number;
    openingBalance?: number;
    closingBalance?: number;
  }
) => {
  try {
    console.log(`Aktualizacja szczegółów raportu ${reportId} z danymi:`, financialSummary);
    
    // Sprawdź, czy już istnieją szczegóły dla tego raportu
    const { data: existingDetails } = await supabase
      .from('report_details')
      .select('id')
      .eq('report_id', reportId);
      
    const closingBalance = (financialSummary.openingBalance || 0) + financialSummary.balance;
      
    if (existingDetails && existingDetails.length > 0) {
      // Aktualizuj istniejące szczegóły
      const { data, error } = await supabase
        .from('report_details')
        .update({
          income_total: financialSummary.income,
          expense_total: financialSummary.expense,
          balance: financialSummary.balance,
          opening_balance: financialSummary.openingBalance || 0,
          closing_balance: closingBalance,
          updated_at: new Date().toISOString()
        })
        .eq('report_id', reportId);
        
      if (error) {
        console.error('Błąd przy aktualizacji szczegółów raportu:', error);
        throw error;
      }
      
      console.log('Pomyślnie zaktualizowano szczegóły raportu');
      return data;
    } else {
      // Utwórz nowe szczegóły
      const { data, error } = await supabase
        .from('report_details')
        .insert({
          report_id: reportId,
          income_total: financialSummary.income,
          expense_total: financialSummary.expense,
          balance: financialSummary.balance,
          opening_balance: financialSummary.openingBalance || 0,
          closing_balance: closingBalance,
          settlements_total: 0
        })
        .select()
        .single();
        
      if (error) {
        console.error('Błąd przy tworzeniu szczegółów raportu:', error);
        throw error;
      }
      
      console.log('Pomyślnie utworzono szczegóły raportu');
      return data;
    }
  } catch (error) {
    console.error('Błąd podczas aktualizacji szczegółów raportu:', error);
    throw error;
  }
};

/**
 * Zapisuje szczegółowe informacje o kontach dla raportu
 */
export const saveReportAccountDetails = async (
  reportId: string,
  accountBreakdown: Array<{
    account_id: string;
    account_number: string;
    account_name: string;
    income: number;
    expense: number;
  }>
) => {
  try {
    // Usuń stare szczegóły kont dla tego raportu
    await supabase
      .from('report_account_details')
      .delete()
      .eq('report_id', reportId);

    // Dodaj nowe szczegóły kont
    for (const account of accountBreakdown) {
      if (account.income > 0) {
        await supabase
          .from('report_account_details')
          .insert({
            report_id: reportId,
            account_id: account.account_id,
            account_number: account.account_number,
            account_name: account.account_name,
            account_type: 'income',
            total_amount: account.income
          });
      }
      
      if (account.expense > 0) {
        await supabase
          .from('report_account_details')
          .insert({
            report_id: reportId,
            account_id: account.account_id,
            account_number: account.account_number,
            account_name: account.account_name,
            account_type: 'expense',
            total_amount: account.expense
          });
      }
    }
    
    console.log('Pomyślnie zapisano szczegóły kont dla raportu');
  } catch (error) {
    console.error('Błąd podczas zapisywania szczegółów kont:', error);
    throw error;
  }
};

/**
 * Oblicza i zapisuje automatycznie podsumowanie finansowe dla nowego raportu
 */
export const calculateAndSaveReportSummary = async (
  reportId: string,
  locationId: string,
  month: number | null,
  year: number
) => {
  try {
    console.log(`Automatyczne obliczanie i zapisywanie podsumowania dla raportu ${reportId}`);
    
    let dateFrom: string;
    let dateTo: string;
    
    if (month) {
      // Raport miesięczny
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      dateTo = lastDayOfMonth.toISOString().split('T')[0];
    } else {
      // Raport roczny
      dateFrom = `${year}-01-01`;
      dateTo = `${year}-12-31`;
    }
    
    // Pobierz saldo początkowe z poprzedniego okresu
    const openingBalance = await calculatePreviousPeriodClosingBalance(locationId, year, month);
    
    // Oblicz finansowe podsumowanie
    const summary = await calculateFinancialSummary(locationId, dateFrom, dateTo);
    
    // Zapisz szczegóły raportu w bazie danych
    await updateReportDetails(reportId, {
      ...summary,
      openingBalance
    });
    
    // Zapisz szczegółowe informacje o kontach
    if (summary.accountBreakdown) {
      await saveReportAccountDetails(reportId, summary.accountBreakdown);
    }
    
    console.log('Podsumowanie finansowe zostało automatycznie obliczone i zapisane');
    return { ...summary, openingBalance };
  } catch (error) {
    console.error('Błąd podczas automatycznego obliczania podsumowania:', error);
    // Nie rzucaj błędu, aby nie blokować tworzenia raportu
    return { income: 0, expense: 0, balance: 0, openingBalance: 0 };
  }
};
