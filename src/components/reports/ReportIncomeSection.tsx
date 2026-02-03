import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { INCOME_ACCOUNTS, getIncomeAccountName, INCOME_PREFIXES } from '@/constants/accountNames';
import { formatNumber } from '@/utils/formatUtils';

interface AccountData {
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface ReportIncomeSectionProps {
  accountsData: AccountData[];
  totalIncome: number;
  className?: string;
}

export const ReportIncomeSection: React.FC<ReportIncomeSectionProps> = ({
  accountsData,
  totalIncome,
  className = ''
}) => {
  // Mapuj dane na predefiniowane konta
  const getAccountAmount = (accountPrefix: string): number => {
    const matchingAccounts = accountsData.filter(acc => 
      acc.accountNumber.startsWith(accountPrefix + '-') || 
      acc.accountNumber === accountPrefix
    );
    return matchingAccounts.reduce((sum, acc) => sum + acc.amount, 0);
  };

  // Oblicz sumę dla wszystkich zahardcodowanych kont 7xx
  const calculated7xxTotal = INCOME_PREFIXES.reduce((sum, prefix) => {
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
          {INCOME_ACCOUNTS.map(({ prefix, name }) => {
            const amount = getAccountAmount(prefix);
            return (
              <TableRow key={prefix}>
                <TableCell className="text-center font-mono text-sm">{prefix}</TableCell>
                <TableCell>{name}</TableCell>
                <TableCell className="text-right font-mono">{formatNumber(amount)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell colSpan={2} className="text-right">PRZYCHODY RAZEM:</TableCell>
            <TableCell className="text-right font-mono">{formatNumber(calculated7xxTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportIncomeSection;
