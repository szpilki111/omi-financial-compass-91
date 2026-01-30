import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Lista prefiksów kont rozchodów - tylko 4xx zgodnie z planem
const EXPENSE_ACCOUNT_PREFIXES = [
  '401', '402', '403', '404', '405', '406', '407', '408', '409', '410',
  '411', '412', '413', '414', '415', '416', '417', '418', '419', '420',
  '421', '422', '423', '424', '425', '430', '431', '435', '440', '441',
  '442', '443', '444', '445', '446', '447', '449', '450', '451', '452',
  '453', '455', '456', '457', '458', '459'
];

interface AccountData {
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface ReportExpenseSectionProps {
  accountsData: AccountData[];
  totalExpense: number;
  className?: string;
  accountNamesFromDb?: Map<string, string>;
}

export const ReportExpenseSection: React.FC<ReportExpenseSectionProps> = ({
  accountsData,
  totalExpense,
  className = '',
  accountNamesFromDb
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Get account name - prefer database name, fallback to transaction data
  const getAccountName = (prefix: string): string => {
    if (accountNamesFromDb?.has(prefix)) {
      return accountNamesFromDb.get(prefix)!;
    }
    // Fallback: check if any account in accountsData starts with this prefix
    const matching = accountsData.find(acc => acc.accountNumber.startsWith(prefix));
    return matching?.accountName || prefix;
  };

  // Mapuj dane na predefiniowane konta
  const getAccountAmount = (accountPrefix: string): number => {
    const matchingAccounts = accountsData.filter(acc => 
      acc.accountNumber.startsWith(accountPrefix + '-') || 
      acc.accountNumber === accountPrefix
    );
    return matchingAccounts.reduce((sum, acc) => sum + acc.amount, 0);
  };

  // Oblicz sumę tylko dla kont 4xx
  const calculated4xxTotal = EXPENSE_ACCOUNT_PREFIXES.reduce((sum, prefix) => {
    return sum + getAccountAmount(prefix);
  }, 0);

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-bold mb-3 text-center">II. ROZCHODY</h3>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-24 text-center font-semibold">Nr. konta</TableHead>
            <TableHead className="font-semibold">Treść</TableHead>
            <TableHead className="w-32 text-right font-semibold">kwota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {EXPENSE_ACCOUNT_PREFIXES.map((prefix) => {
            const amount = getAccountAmount(prefix);
            const name = getAccountName(prefix);
            return (
              <TableRow key={prefix}>
                <TableCell className="text-center font-mono text-sm">{prefix}</TableCell>
                <TableCell>{name}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
              </TableRow>
            );
          })}
          
          {/* Suma rozchodów */}
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell colSpan={2} className="text-right">ROZCHODY RAZEM:</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(calculated4xxTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export { EXPENSE_ACCOUNT_PREFIXES };
export default ReportExpenseSection;
