
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
        location_id
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

    let income = 0;
    let expense = 0;
    
    // Jeśli nie mamy transakcji, zwróć zerowe wartości
    if (!formattedTransactions || formattedTransactions.length === 0) {
      return { income: 0, expense: 0, balance: 0, transactions: [] };
    }
    
    formattedTransactions.forEach(transaction => {
      const debitAccountNumber = accountsMap.get(transaction.debit_account_id)?.number || '';
      const creditAccountNumber = accountsMap.get(transaction.credit_account_id)?.number || '';
      
      // Przychody - konta zaczynające się od 7
      if (creditAccountNumber.startsWith('7')) {
        income += transaction.amount;
      }
      
      // Koszty - konta zaczynające się od 4
      if (debitAccountNumber.startsWith('4')) {
        expense += transaction.amount;
      }
    });
    
    // Oblicz bilans
    const balance = income - expense;
    
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
