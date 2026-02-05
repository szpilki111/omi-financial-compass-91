 import { KpirTransaction } from "@/types/kpir";
 import { getFirstDayOfMonth, getLastDayOfMonth } from "./dateUtils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Oblicza podsumowanie finansowe na podstawie transakcji dla jednej lub wielu lokalizacji i okresu
 */
export const calculateFinancialSummary = async (
  locationIds: string | string[] | null | undefined,
  dateFrom?: string,
  dateTo?: string
) => {
  try {
    // Konwertuj locationIds na tablicę
    const locationIdsArray = locationIds 
      ? (Array.isArray(locationIds) ? locationIds : [locationIds])
      : null;

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
        credit_amount,
        debit_account:accounts!debit_account_id(number, name),
        credit_account:accounts!credit_account_id(number, name)
      `)
      .order('date', { ascending: false });

    // Filtr po lokalizacjach
    if (locationIdsArray && locationIdsArray.length > 0) {
      if (locationIdsArray.length === 1) {
        query = query.eq('location_id', locationIdsArray[0]);
      } else {
        query = query.in('location_id', locationIdsArray);
      }
    }

    // Zastosuj filtr daty od
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    
    // Zastosuj filtr daty do
    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("❌ Błąd pobierania transakcji:", error);
      throw error;
    }

    console.log(`✅ Pobrano ${transactions?.length || 0} transakcji dla lokalizacji`, {
      locationIdsArray,
      dateFrom,
      dateTo,
      transactionsCount: transactions?.length || 0
    });

    if (!transactions || transactions.length === 0) {
      console.log('⚠️ Brak transakcji do analizy');
      return { income: 0, expense: 0, balance: 0, transactions: [] };
    }

    // Funkcja do wyciągania bazowego numeru konta (bez sufiksu lokalizacji)
    const getBaseAccount = (num: string) => num?.split('-')[0] || '';

    let income = 0;
    let expense = 0;

    // Analiza każdej transakcji
    // PRZYCHODY: tylko 7xx MA (zgodnie z nowym planem - usunięto 2xx)
    // KOSZTY: tylko 4xx WN (zgodnie z nowym planem - usunięto 2xx)
    transactions.forEach((transaction: any, index: number) => {
      const debitNum = transaction.debit_account?.number || '';
      const creditNum = transaction.credit_account?.number || '';
      const baseDebit = getBaseAccount(debitNum);
      const baseCredit = getBaseAccount(creditNum);

      // PRZYCHODY: tylko 7xx MA
      if (baseCredit && baseCredit.startsWith('7')) {
        const amount = transaction.credit_amount ?? transaction.amount ?? 0;
        if (amount > 0) {
          income += amount;
          console.log(`  ✅ PRZYCHÓD [${index}]: ${creditNum} (${baseCredit}) → ${amount} PLN`);
        }
      }

      // KOSZTY: tylko 4xx WN
      if (baseDebit && baseDebit.startsWith('4')) {
        const amount = transaction.debit_amount ?? transaction.amount ?? 0;
        if (amount > 0) {
          expense += amount;
          console.log(`  ✅ KOSZT [${index}]: ${debitNum} (${baseDebit}) → ${amount} PLN`);
        }
      }
    });

    const balance = income - expense;

    console.log(`✅ PODSUMOWANIE:`, {
      income,
      expense,
      balance,
      transactionsAnalyzed: transactions.length
    });

    return {
      income,
      expense,
      balance,
      transactions: []
    };
  } catch (error) {
    console.error('❌ Błąd podczas obliczania podsumowania finansowego:', error);
    return { income: 0, expense: 0, balance: 0, transactions: [] };
  }
};

/**
 * Pobiera saldo otwarcia dla danego miesiąca i roku
 * Saldo otwarcia = saldo zamknięcia poprzedniego miesiąca
 * Obsługuje wiele lokalizacji - sumuje salda
 */
export const getOpeningBalance = async (
  locationIds: string | string[],
  month: number,
  year: number
): Promise<number> => {
  try {
    // Konwertuj na tablicę
    const locationIdsArray = Array.isArray(locationIds) ? locationIds : [locationIds];
    
    // Dla stycznia pobierz saldo z grudnia poprzedniego roku
    let previousMonth = month - 1;
    let previousYear = year;
    
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear = year - 1;
    }

    // Sprawdź czy istnieją raporty z poprzedniego miesiąca dla wszystkich lokalizacji
    const { data: previousReports, error } = await supabase
      .from('reports')
      .select(`
        id,
        location_id,
        report_details (
          opening_balance,
          balance
        )
      `)
      .in('location_id', locationIdsArray)
      .eq('month', previousMonth)
      .eq('year', previousYear);

    if (error) {
      console.error(`❌ Błąd pobierania raportów z poprzedniego okresu:`, error);
      return 0;
    }

    if (!previousReports || previousReports.length === 0) {
      console.log(`ℹ️ Brak raportów z poprzedniego okresu (${previousMonth}/${previousYear})`);
      return 0;
    }

    // Sumuj salda zamknięcia ze wszystkich lokalizacji
    let totalOpeningBalance = 0;
    
    previousReports.forEach((report: any) => {
      const reportDetails = Array.isArray(report.report_details) 
        ? report.report_details[0] 
        : report.report_details;

      if (reportDetails) {
        const openingBalance = reportDetails.opening_balance || 0;
        const balance = reportDetails.balance || 0;
        totalOpeningBalance += (openingBalance + balance);
      }
    });

    console.log(`✅ Saldo otwarcia dla ${month}/${year} (${locationIdsArray.length} lokalizacji):`, {
      previousMonth,
      previousYear,
      locationsCount: previousReports.length,
      totalOpeningBalance
    });

    return totalOpeningBalance;
  } catch (error) {
    console.error("❌ Błąd pobierania salda otwarcia:", error);
    return 0;
  }
};

/**
 * Pobierz szczegóły finansowe dla konkretnego raportu
 */
export const getReportFinancialDetails = async (reportId: string) => {
  try {
    const { data: reportDetails, error: reportDetailsError } = await supabase
      .from('report_details')
      .select('*')
      .eq('report_id', reportId)
      .maybeSingle();
    
    if (reportDetailsError) {
      console.error('❌ Błąd podczas pobierania szczegółów raportu:', reportDetailsError);
      return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0 };
    }
    
    if (!reportDetails) {
      return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0 };
    }
    
    return {
      income: Number(reportDetails.income_total) || 0,
      expense: Number(reportDetails.expense_total) || 0,
      balance: Number(reportDetails.balance) || 0,
      settlements: Number(reportDetails.settlements_total) || 0,
      openingBalance: Number(reportDetails.opening_balance) || 0
    };
  } catch (error) {
    console.error('❌ Błąd podczas pobierania szczegółów finansowych raportu:', error);
    return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0 };
  }
};

/**
 * Aktualizuje szczegóły finansowe raportu
 */
export const updateReportDetails = async (
  reportId: string, 
  financialSummary: { income: number, expense: number, balance: number, openingBalance?: number }
) => {
  try {
    // Sprawdź, czy już istnieją szczegóły dla tego raportu
    const { data: existingDetails } = await supabase
      .from('report_details')
      .select('id')
      .eq('report_id', reportId);
      
    if (existingDetails && existingDetails.length > 0) {
      const updateData: any = {
        income_total: financialSummary.income,
        expense_total: financialSummary.expense,
        balance: financialSummary.balance,
        updated_at: new Date().toISOString()
      };
      
      if (financialSummary.openingBalance !== undefined) {
        updateData.opening_balance = financialSummary.openingBalance;
      }
      
      const { data, error } = await supabase
        .from('report_details')
        .update(updateData)
        .eq('report_id', reportId);
        
      if (error) {
        console.error('❌ Błąd przy aktualizacji szczegółów raportu:', error);
        throw error;
      }
      
      return data;
    } else {
      const insertData: any = {
        report_id: reportId,
        income_total: financialSummary.income,
        expense_total: financialSummary.expense,
        balance: financialSummary.balance,
        settlements_total: 0,
        opening_balance: financialSummary.openingBalance || 0
      };
      
      const { data, error } = await supabase
        .from('report_details')
        .insert(insertData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Błąd przy tworzeniu szczegółów raportu:', error);
        throw error;
      }
      
      return data;
    }
  } catch (error) {
    console.error('❌ Błąd podczas aktualizacji szczegółów raportu:', error);
    throw error;
  }
};

/**
 * Oblicza i zapisuje automatycznie podsumowanie finansowe dla raportu
 */
export const calculateAndSaveReportSummary = async (
  reportId: string,
  locationId: string,
  month: number,
  year: number
) => {
  try {
    // Oblicz daty na podstawie miesiąca i roku
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    const dateFrom = getFirstDayOfMonth(year, month);
    const dateTo = getLastDayOfMonth(year, month);
    
    // Pobierz saldo otwarcia
    const openingBalance = await getOpeningBalance(locationId, month, year);
    
    // Oblicz finansowe podsumowanie
    const summary = await calculateFinancialSummary(locationId, dateFrom, dateTo);
    
    // Zapisz szczegóły raportu w bazie danych wraz z saldem otwarcia
    await updateReportDetails(reportId, {
      ...summary,
      openingBalance
    });
    
    return { ...summary, openingBalance };
  } catch (error) {
    console.error('❌ Błąd podczas automatycznego obliczania podsumowania:', error);
    // Nie rzucaj błędu, aby nie blokować tworzenia raportu
    return { income: 0, expense: 0, balance: 0, openingBalance: 0 };
  }
};
