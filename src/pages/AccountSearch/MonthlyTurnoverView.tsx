
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
  /** Obroty Wn w walutach obcych (kwoty oryginalne, bez przeliczenia) */
  debitByCurrency?: Map<string, number>;
  /** Obroty Ma w walutach obcych (kwoty oryginalne, bez przeliczenia) */
  creditByCurrency?: Map<string, number>;
}

interface MonthlyTurnoverViewProps {
  monthlyData: MonthlyData[];
  selectedAccount: Account;
  onViewMonth: (month: number) => void;
  openingBalanceForYear?: number;
  /** Salda otwarcia roku w walutach obcych (kwoty oryginalne) */
  openingCurrencyBalances?: Map<string, number>;
}

const MonthlyTurnoverView: React.FC<MonthlyTurnoverViewProps> = ({
  monthlyData,
  selectedAccount,
  onViewMonth,
  openingBalanceForYear = 0,
  openingCurrencyBalances,
}) => {
  // Determine if this is a balance account (0xx, 1xx, 2xx) that should show opening/closing balances
  const accountPrefix = selectedAccount.number.split('-')[0];
  const isBalanceAccount = accountPrefix.startsWith('0') || 
                            accountPrefix.startsWith('1') || 
                            accountPrefix.startsWith('2');

  // Sort monthly data chronologically (oldest first) for calculating running balance
  const sortedMonthlyData = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
  
  // Zbiór walut obcych występujących na koncie (saldo otwarcia + obroty)
  const currencies = React.useMemo(() => {
    const set = new Set<string>();
    openingCurrencyBalances?.forEach((v, c) => {
      if (Math.abs(v) > 0.005) set.add(c);
    });
    monthlyData.forEach((m) => {
      m.debitByCurrency?.forEach((v, c) => {
        if (Math.abs(v) > 0.005) set.add(c);
      });
      m.creditByCurrency?.forEach((v, c) => {
        if (Math.abs(v) > 0.005) set.add(c);
      });
    });
    return Array.from(set).sort();
  }, [monthlyData, openingCurrencyBalances]);

  // Calculate opening balance for each month based on cumulative transactions
  let runningBalance = openingBalanceForYear;
  const runningCurrency = new Map<string, number>();
  currencies.forEach((c) => runningCurrency.set(c, openingCurrencyBalances?.get(c) || 0));
  const dataWithBalances = sortedMonthlyData.map((monthData) => {
    const openingBalance = runningBalance;
    const closingBalance = openingBalance + monthData.debit - monthData.credit;
    runningBalance = closingBalance;

    const openingCurrency = new Map<string, number>(runningCurrency);
    const closingCurrency = new Map<string, number>();
    currencies.forEach((c) => {
      const val =
        (openingCurrency.get(c) || 0) +
        (monthData.debitByCurrency?.get(c) || 0) -
        (monthData.creditByCurrency?.get(c) || 0);
      closingCurrency.set(c, val);
      runningCurrency.set(c, val);
    });

    return {
      ...monthData,
      openingBalance,
      closingBalance,
      openingCurrency,
      closingCurrency,
    };
  });

  // Reverse back to show newest first in UI
  const displayData = [...dataWithBalances].reverse();

  // Calculate totals
  const totalDebit = monthlyData.reduce((sum, m) => sum + m.debit, 0);
  const totalCredit = monthlyData.reduce((sum, m) => sum + m.credit, 0);
  const finalBalance = openingBalanceForYear + totalDebit - totalCredit;

  const sumByCurrency = (
    picker: (m: MonthlyData) => Map<string, number> | undefined,
  ): Map<string, number> => {
    const out = new Map<string, number>();
    currencies.forEach((c) => {
      out.set(
        c,
        monthlyData.reduce((s, m) => s + (picker(m)?.get(c) || 0), 0),
      );
    });
    return out;
  };
  const totalDebitCurrency = sumByCurrency((m) => m.debitByCurrency);
  const totalCreditCurrency = sumByCurrency((m) => m.creditByCurrency);
  const finalCurrency = new Map<string, number>();
  currencies.forEach((c) =>
    finalCurrency.set(
      c,
      (openingCurrencyBalances?.get(c) || 0) +
        (totalDebitCurrency.get(c) || 0) -
        (totalCreditCurrency.get(c) || 0),
    ),
  );

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  const formatForeign = (value: number, code: string) =>
    `(${value.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${code})`;

  // Nawias z walutą pokazujemy tylko dla kont, na których faktycznie są
  // kwoty przeliczane z walut obcych (analogicznie do paska walutowego u góry).
  const ForeignLines: React.FC<{ values?: Map<string, number> }> = ({ values }) => {
    if (!values || currencies.length === 0) return null;
    const lines = currencies
      .map((c) => ({ c, v: values.get(c) || 0 }))
      .filter((x) => Math.abs(x.v) > 0.005);
    if (lines.length === 0) return null;
    return (
      <div className="text-xs font-normal text-muted-foreground">
        {lines.map(({ c, v }) => (
          <div key={c}>{formatForeign(v, c)}</div>
        ))}
      </div>
    );
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
