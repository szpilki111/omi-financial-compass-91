import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Lista prefiksów kont przychodów - tylko 7xx zgodnie z planem
const INCOME_ACCOUNT_PREFIXES = [
  '701', '702', '703', '704', '705', '706', '707', '708', '709', '710',
  '711', '712', '713', '714', '715', '716', '717', '718', '719', '720',
  '721', '722', '725', '727', '728', '730'
];

interface AccountData {
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface ReportIncomeSectionProps {
  accountsData: AccountData[];
  totalIncome: number;
  className?: string;
  accountNamesFromDb?: Map<string, string>;
}

export const ReportIncomeSection: React.FC<ReportIncomeSectionProps> = ({
  accountsData,
  totalIncome,
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

  // Oblicz sumę tylko dla kont 7xx
  const calculated7xxTotal = INCOME_ACCOUNT_PREFIXES.reduce((sum, prefix) => {
    return sum + getAccountAmount(prefix);
  }, 0);

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-bold mb-3 text-center">I. PRZYCHODY</h3>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-24 text-center font-semibold">Nr. konta</TableHead>
            <TableHead className="font-semibold">Treść</TableHead>
            <TableHead className="w-32 text-right font-semibold">kwota</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INCOME_ACCOUNT_PREFIXES.map((prefix) => {
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
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell colSpan={2} className="text-right">PRZYCHODY RAZEM:</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(calculated7xxTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export { INCOME_ACCOUNT_PREFIXES };
export default ReportIncomeSection;
