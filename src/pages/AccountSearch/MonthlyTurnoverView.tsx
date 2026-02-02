
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface MonthlyData {
  month: string;
  monthName: string;
  transactions: any[];
  debit: number;
  credit: number;
  openingBalance?: number;
}

interface MonthlyTurnoverViewProps {
  monthlyData: MonthlyData[];
  selectedAccount: Account;
  onViewMonth: (month: number) => void;
  openingBalanceForYear?: number;
}

const MonthlyTurnoverView: React.FC<MonthlyTurnoverViewProps> = ({
  monthlyData,
  selectedAccount,
  onViewMonth,
  openingBalanceForYear = 0,
}) => {
  // Determine if this is a balance account (0xx, 1xx, 2xx) that should show opening/closing balances
  const accountPrefix = selectedAccount.number.split('-')[0];
  const isBalanceAccount = accountPrefix.startsWith('0') || 
                            accountPrefix.startsWith('1') || 
                            accountPrefix.startsWith('2');

  // Sort monthly data chronologically (oldest first) for calculating running balance
  const sortedMonthlyData = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
  
  // Calculate opening balance for each month based on cumulative transactions
  let runningBalance = openingBalanceForYear;
  const dataWithBalances = sortedMonthlyData.map((monthData) => {
    const openingBalance = runningBalance;
    const closingBalance = openingBalance + monthData.debit - monthData.credit;
    runningBalance = closingBalance;
    return {
      ...monthData,
      openingBalance,
      closingBalance,
    };
  });

  // Reverse back to show newest first in UI
  const displayData = [...dataWithBalances].reverse();

  // Calculate totals
  const totalDebit = monthlyData.reduce((sum, m) => sum + m.debit, 0);
  const totalCredit = monthlyData.reduce((sum, m) => sum + m.credit, 0);
  const finalBalance = openingBalanceForYear + totalDebit - totalCredit;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Obroty miesięczne - konto {selectedAccount.number}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {monthlyData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Brak obrotów do wyświetlenia
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Miesiąc</TableHead>
                  <TableHead className="text-center">Operacje</TableHead>
                  {isBalanceAccount && (
                    <TableHead className="text-right min-w-[120px]">Saldo początkowe</TableHead>
                  )}
                  <TableHead className="text-right min-w-[120px]">Obroty Wn</TableHead>
                  <TableHead className="text-right min-w-[120px]">Obroty Ma</TableHead>
                  {isBalanceAccount ? (
                    <TableHead className="text-right min-w-[120px]">Saldo końcowe</TableHead>
                  ) : (
                    <TableHead className="text-right min-w-[120px]">Saldo</TableHead>
                  )}
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((monthData) => {
                  const monthNumber = parseInt(monthData.month.split('-')[1]);
                  const balance = monthData.debit - monthData.credit;
                  
                  return (
                    <TableRow key={monthData.month}>
                      <TableCell className="font-medium">{monthData.monthName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{monthData.transactions.length}</Badge>
                      </TableCell>
                      {isBalanceAccount && (
                        <TableCell className="text-right font-medium">
                          {formatCurrency(monthData.openingBalance || 0)}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-red-600 font-medium">
                        {formatCurrency(monthData.debit)}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatCurrency(monthData.credit)}
                      </TableCell>
                      {isBalanceAccount ? (
                        <TableCell className={`text-right font-bold ${monthData.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(monthData.closingBalance || 0)}
                        </TableCell>
                      ) : (
                        <TableCell className={`text-right font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(balance)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewMonth(monthNumber)}
                          className="flex items-center gap-1 whitespace-nowrap"
                        >
                          <Eye className="h-3 w-3" />
                          Szczegóły
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Summary row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>RAZEM</TableCell>
                  <TableCell className="text-center">
                    <Badge>{monthlyData.reduce((sum, m) => sum + m.transactions.length, 0)}</Badge>
                  </TableCell>
                  {isBalanceAccount && (
                    <TableCell className="text-right">
                      {formatCurrency(openingBalanceForYear)}
                    </TableCell>
                  )}
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(totalCredit)}
                  </TableCell>
                  <TableCell className={`text-right ${finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(isBalanceAccount ? finalBalance : (totalDebit - totalCredit))}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyTurnoverView;
