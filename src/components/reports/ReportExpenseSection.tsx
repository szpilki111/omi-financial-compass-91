import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EXPENSE_ACCOUNTS, getExpenseAccountName, EXPENSE_PREFIXES } from '@/constants/accountNames';
import { formatNumber } from '@/utils/formatUtils';

interface AccountData {
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface ReportExpenseSectionProps {
  accountsData: AccountData[];
  totalExpense: number;
  className?: string;
}

export const ReportExpenseSection: React.FC<ReportExpenseSectionProps> = ({
  accountsData,
  totalExpense,
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

  // Oblicz sumę dla wszystkich zahardcodowanych kont 4xx
  const calculated4xxTotal = EXPENSE_PREFIXES.reduce((sum, prefix) => {
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
          {EXPENSE_ACCOUNTS.map(({ prefix, name }) => {
            const amount = getAccountAmount(prefix);
            return (
              <TableRow key={prefix}>
                <TableCell className="text-center font-mono text-sm">{prefix}</TableCell>
                <TableCell>{name}</TableCell>
                <TableCell className="text-right font-mono">{formatNumber(amount)}</TableCell>
              </TableRow>
            );
          })}
          
          {/* Suma rozchodów */}
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell colSpan={2} className="text-right">ROZCHODY RAZEM:</TableCell>
            <TableCell className="text-right font-mono">{formatNumber(calculated4xxTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportExpenseSection;
