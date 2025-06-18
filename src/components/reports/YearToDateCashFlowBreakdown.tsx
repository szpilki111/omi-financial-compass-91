import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/Spinner';

interface AccountBalance {
  account_number: string;
  account_name: string;
  balance: number;
  side: 'debit' | 'credit';
}

interface CashFlowCategory {
  title: string;
  accounts: AccountBalance[];
  total: number;
}

interface YearToDateCashFlowBreakdownProps {
  locationId: string;
  month: number;
  year: number;
}

const YearToDateCashFlowBreakdown: React.FC<YearToDateCashFlowBreakdownProps> = ({ 
  locationId, 
  month, 
  year 
}) => {
  const { data: cashFlowData, isLoading } = useQuery({
    queryKey: ['cash_flow_breakdown', locationId, month, year],
    queryFn: async () => {
      // Oblicz daty na podstawie miesiąca i roku
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

      // Pobierz wszystkie transakcje dla danej lokalizacji w okresie
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          debit_account_id,
          credit_account_id,
          debit_amount,
          credit_amount,
          debit_account:accounts!debit_account_id(number, name, type),
          credit_account:accounts!credit_account_id(number, name, type)
        `)
        .eq('location_id', locationId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      // Definiuj kategorie zgodnie z obrazkiem
      const categoryDefinitions = {
        'A. Stan finansowy domu': {
          'Kasa domu': ['100'],
          'Kasa dewiz': ['101', '102', '103', '104', '105', '106', '107', '108'],
          'Bank': ['110'],
          'Lokaty bankowe': ['117'],
          'Bank dewizowy': ['113', '114', '115', '116']
        },
        'B. Intencje': {
          'Intencje': ['210', '701']
        },
        'C. Towary': {
          'Towary': ['301', '449']
        },
        'D. Należności i zobowiązania': {
          'Pożyczki udzielone': ['212', '213'],
          'Pożyczki zaciągnięte': ['215'],
          'Sumy przechodnie': ['149', '150'],
          'Rozliczenia z prowincją': ['200', '201'],
          'Rozliczenia z innymi': ['202', '208']
        }
      };

      // Funkcja do sprawdzania czy numer konta pasuje do prefiksu
      const matchesPrefix = (accountNumber: string, prefixes: string[]) => {
        return prefixes.some(prefix => accountNumber.startsWith(prefix));
      };

      // Oblicz salda dla każdej kategorii
      const calculateCategoryBalances = () => {
        const accountBalances = new Map<string, { balance: number, account: any }>();
        
        // Przelicz salda wszystkich kont
        transactions?.forEach(transaction => {
          const { debit_account, credit_account, debit_amount, credit_amount, amount } = transaction;
          
          // Dla konta debetowego
          if (debit_account) {
            const key = debit_account.number;
            const transactionAmount = debit_amount && debit_amount > 0 ? debit_amount : Number(amount);
            
            if (accountBalances.has(key)) {
              accountBalances.get(key)!.balance += transactionAmount;
            } else {
              accountBalances.set(key, {
                balance: transactionAmount,
                account: debit_account
              });
            }
          }
          
          // Dla konta kredytowego
          if (credit_account) {
            const key = credit_account.number;
            const transactionAmount = credit_amount && credit_amount > 0 ? credit_amount : Number(amount);
            
            if (accountBalances.has(key)) {
              accountBalances.get(key)!.balance -= transactionAmount;
            } else {
              accountBalances.set(key, {
                balance: -transactionAmount,
                account: credit_account
              });
            }
          }
        });

        return accountBalances;
      };

      const accountBalances = calculateCategoryBalances();
      const result: Record<string, CashFlowCategory[]> = {};

      // Grupuj konta według kategorii
      Object.entries(categoryDefinitions).forEach(([mainCategory, subCategories]) => {
        const categoryData: CashFlowCategory[] = [];
        
        Object.entries(subCategories).forEach(([subCategoryName, prefixes]) => {
          const matchingAccounts: AccountBalance[] = [];
          let categoryTotal = 0;
          
          accountBalances.forEach(({ balance, account }, accountNumber) => {
            if (matchesPrefix(accountNumber, prefixes)) {
              // Dla kategorii "Intencje" użyj wartości bezwzględnej
              const displayBalance = mainCategory === 'B. Intencje' ? Math.abs(balance) : balance;
              
              matchingAccounts.push({
                account_number: accountNumber,
                account_name: account.name,
                balance: displayBalance,
                side: balance >= 0 ? 'debit' : 'credit'
              });
              
              // Również dla sumy kategorii użyj wartości bezwzględnej dla Intencji
              categoryTotal += mainCategory === 'B. Intencje' ? Math.abs(balance) : balance;
            }
          });
          
          // Sortuj konta według numeru
          matchingAccounts.sort((a, b) => a.account_number.localeCompare(b.account_number));
          
          categoryData.push({
            title: subCategoryName,
            accounts: matchingAccounts,
            total: categoryTotal
          });
        });
        
        result[mainCategory] = categoryData;
      });

      return result;
    },
    enabled: !!locationId
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!cashFlowData || Object.keys(cashFlowData).length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        Brak danych do wyświetlenia
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4 text-black">Stan kasowy i finansowy domu</h3>
      <p className="text-sm text-gray-600 mb-6">
        Szczegółowa rozpiska stanu finansowego według kategorii księgowych na koniec okresu
      </p>
      
      <div className="space-y-8">
        {Object.entries(cashFlowData).map(([mainCategory, categories]) => (
          <div key={mainCategory} className="border-b border-gray-200 pb-6 last:border-b-0">
            <h4 className="text-md font-semibold mb-4 text-black">{mainCategory}</h4>
            
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.title} className="bg-gray-50 p-4 rounded">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium text-gray-800">{category.title}</h5>
                    <div className="font-bold text-black">
                      {formatCurrency(category.total)}
                    </div>
                  </div>
                  
                  {category.accounts.length > 0 ? (
                    <div className="space-y-2">
                      {category.accounts.map((account) => (
                        <div key={account.account_number} className="flex justify-between text-sm">
                          <div className="flex-1">
                            <span className="font-medium text-gray-700">{account.account_number}</span>
                            <span className="ml-2 text-gray-600">{account.account_name}</span>
                          </div>
                          <div className="font-medium text-black">
                            {formatCurrency(account.balance)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      Brak transakcji w okresie dla tej kategorii
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-300">
        <p className="text-xs text-gray-500">
          * Dane przedstawiają stan finansowy na podstawie transakcji zarejestrowanych w okresie
        </p>
      </div>
    </div>
  );
};

export default YearToDateCashFlowBreakdown;
