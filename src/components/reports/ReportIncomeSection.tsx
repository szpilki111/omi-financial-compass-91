import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Predefiniowana lista kont przychodów zgodna ze wzorem raportu
const INCOME_ACCOUNTS = [
  { number: '210', name: 'Intencje przyjęte' },
  { number: '212', name: 'Zwrot pożyczki' },
  { number: '215', name: 'Zaciągnięte pożyczki' },
  { number: '217', name: 'Sumy przechodnie' },
  { number: '225', name: 'Sprzedaż towarów' },
  { number: '701', name: 'Intencje odprawione na dom' },
  { number: '702', name: 'Duszpasterstwo OMI' },
  { number: '703', name: 'Stałe ofiary' },
  { number: '704', name: 'Ofiary z nabożeństw' },
  { number: '705', name: 'Kolęda, opłatek' },
  { number: '706', name: 'Ofiary okazjonalne' },
  { number: '707', name: 'Stypendia, dotacje, emerytury' },
  { number: '708', name: 'Dotacje z kurii' },
  { number: '709', name: 'Wynajem, dzierżawa' },
  { number: '710', name: 'Darowizny' },
  { number: '711', name: 'Różne wpływy' },
  { number: '712', name: 'Spadki, zapisy' },
  { number: '713', name: 'Przychód ze sprzedaży' },
  { number: '714', name: 'Odsetki bankowe' },
  { number: '715', name: 'Dotacje z funduszy UE' },
  { number: '716', name: 'Dochód ze składek' },
  { number: '717', name: 'Dochód z działalności' },
  { number: '725', name: 'Inne przychody' },
  { number: '730', name: 'Przychody finansowe' },
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
}

export const ReportIncomeSection: React.FC<ReportIncomeSectionProps> = ({
  accountsData,
  totalIncome,
  className = ''
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Mapuj dane na predefiniowane konta
  const getAccountAmount = (accountPrefix: string): number => {
    const matchingAccounts = accountsData.filter(acc => 
      acc.accountNumber.startsWith(accountPrefix + '-') || 
      acc.accountNumber === accountPrefix
    );
    return matchingAccounts.reduce((sum, acc) => sum + acc.amount, 0);
  };

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
          {INCOME_ACCOUNTS.map((account) => {
            const amount = getAccountAmount(account.number);
            return (
              <TableRow key={account.number}>
                <TableCell className="text-center font-mono text-sm">{account.number}</TableCell>
                <TableCell>{account.name}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell colSpan={2} className="text-right">PRZYCHODY RAZEM:</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totalIncome)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportIncomeSection;
