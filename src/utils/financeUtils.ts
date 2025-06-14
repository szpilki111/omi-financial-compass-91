import { KpirTransaction } from "@/types/kpir";
import { supabase } from "@/integrations/supabase/client";

/**
 * Oblicza podsumowanie finansowe na podstawie transakcji dla określonej lokalizacji i okresu
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

    console.log('Pobrane transakcje:', data);

    // Pobierz informacje o kontach
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, number, name');

    if (accountsError) {
      throw accountsError;
    }

    const accountsMap = new Map(accounts.map((acc: any) => [acc.id, { number: acc.number, name: acc.name }]));

    const formattedTransactions: KpirTransaction[] = data.map((transaction: any) => ({
      ...transaction,
      debitAccount: accountsMap.get(transaction.debit_account_id) || { number: 'Nieznane', name: 'Nieznane konto' },
      creditAccount: accountsMap.get(transaction.credit_account_id) || { number: 'Nieznane', name: 'Nieznane konto' },
      formattedDate: new Date(transaction.date).toLocaleDateString('pl-PL'),
      settlement_type: transaction.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek'
    }));

    console.log('Sformatowane transakcje z numerami kont:', formattedTransactions.map(t => ({
      id: t.id,
      debitAccount: t.debitAccount?.number,
      creditAccount: t.creditAccount?.number,
      amount: t.amount,
      debit_amount: t.debit_amount,
      credit_amount: t.credit_amount
    })));

    // Nowa funkcja do sprawdzania kont - zamienia tekst na liczby
    const isPnlIncomeAccount = (accountNum: string) => {
      if (!accountNum) return false;
      
      // Weź pierwsze 3 znaki numeru konta
      const firstThreeChars = accountNum.substring(0, 3);
      console.log(`Sprawdzam konto przychodowe: ${accountNum} -> pierwsze 3 znaki: "${firstThreeChars}"`);
      
      // Zamień na liczbę
      const accountPrefix = parseInt(firstThreeChars, 10);
      console.log(`Zamienione na liczbę: ${accountPrefix}`);
      
      // Sprawdź czy to konto 7xx (700-799)
      const isIncome = accountPrefix >= 700 && accountPrefix <= 799;
      console.log(`Czy to konto przychodowe (700-799)? ${isIncome}`);
      
      return isIncome;
    };

    const isPnlExpenseAccount = (accountNum: string) => {
      if (!accountNum) return false;
      
      // Weź pierwsze 3 znaki numeru konta
      const firstThreeChars = accountNum.substring(0, 3);
      console.log(`Sprawdzam konto kosztowe: ${accountNum} -> pierwsze 3 znaki: "${firstThreeChars}"`);
      
      // Zamień na liczbę
      const accountPrefix = parseInt(firstThreeChars, 10);
      console.log(`Zamienione na liczbę: ${accountPrefix}`);
      
      // Sprawdź czy to konto 4xx (400-499)
      const isExpense = accountPrefix >= 400 && accountPrefix <= 499;
      console.log(`Czy to konto kosztowe (400-499)? ${isExpense}`);
      
      return isExpense;
    };

    let income = 0;
    let expense = 0;

    if (!formattedTransactions || formattedTransactions.length === 0) {
      console.log('Brak transakcji do przetworzenia');
      return { income: 0, expense: 0, balance: 0, transactions: [] };
    }

    console.log(`Rozpoczynam analizę ${formattedTransactions.length} transakcji:`);

    // Analiza każdej transakcji
    formattedTransactions.forEach(transaction => {
      const debitAccountNumber = transaction.debitAccount?.number || '';
      const creditAccountNumber = transaction.creditAccount?.number || '';

      // Użyj kwot debet/kredyt jeśli istnieją, domyślnie amount
      const hasSpecificAmounts = transaction.debit_amount != null || transaction.credit_amount != null;
      const debitAmount = hasSpecificAmounts ? (transaction.debit_amount ?? 0) : transaction.amount;
      const creditAmount = hasSpecificAmounts ? (transaction.credit_amount ?? 0) : transaction.amount;

      console.log(`\n=== Transakcja ${transaction.id} ===`);
      console.log(`Konto WN (debet): "${debitAccountNumber}" | Konto MA (kredyt): "${creditAccountNumber}"`);
      console.log(`Kwota WN: ${debitAmount} | Kwota MA: ${creditAmount} | Oryginalna kwota: ${transaction.amount}`);

      // Przychody: konta 7xx po stronie kredytu (MA)
      if (isPnlIncomeAccount(creditAccountNumber)) {
        income += creditAmount;
        console.log(`✅ PRZYCHÓD: +${creditAmount} zł (konto MA: ${creditAccountNumber})`);
      }

      // Koszty: konta 4xx po stronie debetu (WN)
      if (isPnlExpenseAccount(debitAccountNumber)) {
        expense += debitAmount;
        console.log(`✅ KOSZT: +${debitAmount} zł (konto WN: ${debitAccountNumber})`);
      }

      // Dodatkowe logowanie dla debugowania
      if (!isPnlIncomeAccount(creditAccountNumber) && !isPnlExpenseAccount(debitAccountNumber)) {
        console.log(`ℹ️ Transakcja pomijana - nie wpływa na P&L`);
      }
    });

    console.log(`\n🔢 KOŃCOWE PODSUMOWANIE:`);
    console.log(`📈 Łączne przychody z kont 7xx (MA): ${income} zł`);
    console.log(`📉 Łączne koszty z kont 4xx (WN): ${expense} zł`);

    const balance = income - expense;
    console.log(`💰 Bilans (przychody - koszty): ${balance} zł`);

    return {
      income,
      expense,
      balance,
      transactions: formattedTransactions
    };
  } catch (error) {
    console.error('Błąd podczas obliczania podsumowania finansowego:', error);
    return { income: 0, expense: 0, balance: 0, transactions: [] };
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
      return { income: 0, expense: 0, balance: 0, settlements: 0 };
    }
    
    if (!reportDetails) {
      console.log('Nie znaleziono szczegółów raportu w report_details, zwracam zerowe wartości');
      return { income: 0, expense: 0, balance: 0, settlements: 0 };
    }
    
    // Jeśli znaleziono szczegóły, zwróć je
    return {
      income: Number(reportDetails.income_total) || 0,
      expense: Number(reportDetails.expense_total) || 0,
      balance: Number(reportDetails.balance) || 0,
      settlements: Number(reportDetails.settlements_total) || 0
    };
  } catch (error) {
    console.error('Błąd podczas pobierania szczegółów finansowych raportu:', error);
    return { income: 0, expense: 0, balance: 0, settlements: 0 };
  }
};

/**
 * Aktualizuje szczegóły finansowe raportu
 */
export const updateReportDetails = async (
  reportId: string, 
  financialSummary: { income: number, expense: number, balance: number }
) => {
  try {
    console.log(`Aktualizacja szczegółów raportu ${reportId} z danymi:`, financialSummary);
    
    // Sprawdź, czy już istnieją szczegóły dla tego raportu
    const { data: existingDetails } = await supabase
      .from('report_details')
      .select('id')
      .eq('report_id', reportId);
      
    if (existingDetails && existingDetails.length > 0) {
      // Aktualizuj istniejące szczegóły
      const { data, error } = await supabase
        .from('report_details')
        .update({
          income_total: financialSummary.income,
          expense_total: financialSummary.expense,
          balance: financialSummary.balance,
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
 * Oblicza i zapisuje automatycznie podsumowanie finansowe dla nowego raportu
 */
export const calculateAndSaveReportSummary = async (
  reportId: string,
  locationId: string,
  month: number,
  year: number
) => {
  try {
    console.log(`Automatyczne obliczanie i zapisywanie podsumowania dla raportu ${reportId}`);
    
    // Oblicz daty na podstawie miesiąca i roku
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
    const dateTo = lastDayOfMonth.toISOString().split('T')[0];
    
    // Oblicz finansowe podsumowanie
    const summary = await calculateFinancialSummary(locationId, dateFrom, dateTo);
    
    // Zapisz szczegóły raportu w bazie danych
    await updateReportDetails(reportId, summary);
    
    console.log('Podsumowanie finansowe zostało automatycznie obliczone i zapisane');
    return summary;
  } catch (error) {
    console.error('Błąd podczas automatycznego obliczania podsumowania:', error);
    // Nie rzucaj błędu, aby nie blokować tworzenia raportu
    return { income: 0, expense: 0, balance: 0 };
  }
};
