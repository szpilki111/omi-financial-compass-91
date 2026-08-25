 import { KpirTransaction } from "@/types/kpir";
 import { getFirstDayOfMonth, getLastDayOfMonth } from "./dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "./supabasePagination";
import {
  LocationLike,
  resolveLocationIdForAccount,
} from "./locationAccountMatching";

/**
 * Oblicza podsumowanie finansowe na podstawie transakcji dla jednej lub wielu lokalizacji i okresu.
 *
 * WAŻNE: przypisanie zapisu do placówki wynika z SEGMENTÓW numeru konta (2 i 3),
 * a nie z `transactions.location_id`. Dokument zaksięgowany przez Prowincję na koncie
 * placówki (np. `400-2-13-1`) należy do tej placówki — tak samo jak w raporcie
 * miesięcznym i w widoku „Obroty i salda (globalnie)”.
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

    // Lista placówek potrzebna do dopasowania po numerze konta
    const { data: locationsData, error: locError } = await supabase
      .from('locations')
      .select('id, name, location_identifier');
    if (locError) throw locError;
    const locations = (locationsData || []) as LocationLike[];

    const selectedSet =
      locationIdsArray && locationIdsArray.length > 0 ? new Set(locationIdsArray) : null;

    // Paginacja z deterministycznym sortowaniem – bez tego przy >1000 wierszy
    // część zapisów gubi się między stronami.
    const transactions = await fetchAllRows<any>((from, to) => {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          document_number,
          document_id,
          description,
          amount,
          debit_account_id,
          credit_account_id,
          settlement_type,
          currency,
          exchange_rate,
          debit_amount,
          credit_amount,
          debit_account:accounts!debit_account_id(number, name),
          credit_account:accounts!credit_account_id(number, name),
          document:documents!document_id(currency, exchange_rate)
        `)
        .order('date', { ascending: false })
        .order('id', { ascending: true });

      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);

      return query.range(from, to);
    });

    if (!transactions || transactions.length === 0) {
      return { income: 0, expense: 0, balance: 0, transactions: [] };
    }

    // Funkcja do wyciągania bazowego numeru konta (bez sufiksu lokalizacji)
    const getBaseAccount = (num: string) => num?.split('-')[0] || '';

    /** Czy konto należy do jednej z wybranych placówek (po segmentach numeru). */
    const accountInScope = (accountNumber: string) => {
      if (!selectedSet) return true;
      const locId = resolveLocationIdForAccount(accountNumber, locations);
      return !!locId && selectedSet.has(locId);
    };

    let income = 0;
    let expense = 0;

    // PRZYCHODY: tylko 7xx MA, KOSZTY: tylko 4xx WN
    // WAŻNE: Dla walut obcych przeliczamy po kursie z dokumentu!
    transactions.forEach((transaction: any) => {
      const debitNum = transaction.debit_account?.number || '';
      const creditNum = transaction.credit_account?.number || '';
      const baseDebit = getBaseAccount(debitNum);
      const baseCredit = getBaseAccount(creditNum);

      const docCurrency = transaction.document?.currency || transaction.currency || 'PLN';
      const docExchangeRate = transaction.document?.exchange_rate || transaction.exchange_rate || 1;
      const multiplier = docCurrency !== 'PLN' ? docExchangeRate : 1;

      if (baseCredit && baseCredit.startsWith('7') && accountInScope(creditNum)) {
        const rawAmount = transaction.credit_amount ?? transaction.amount ?? 0;
        if (rawAmount > 0) income += rawAmount * multiplier;
      }

      if (baseDebit && baseDebit.startsWith('4') && accountInScope(debitNum)) {
        const rawAmount = transaction.debit_amount ?? transaction.amount ?? 0;
        if (rawAmount > 0) expense += rawAmount * multiplier;
      }
    });

    const balance = income - expense;

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
