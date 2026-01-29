import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Nowa lista kont przychodów - tylko 7xx zgodnie z planem
const INCOME_ACCOUNTS = [
  { number: '701', name: 'Intencje odprawione na dom' },
  { number: '702', name: 'Duszpasterstwo OMI' },
  { number: '703', name: 'Duszpasterstwo parafialne' },
  { number: '704', name: 'Kolęda' },
  { number: '705', name: 'Zastępstwa zagraniczne' },
  { number: '706', name: 'Ofiary okazjonalne' },
  { number: '707', name: 'Stypendia, dotacje, emerytury' },
  { number: '708', name: 'Dotacje z kurii' },
  { number: '709', name: 'Wynajem, dzierżawa' },
  { number: '710', name: 'Odsetki' },
  { number: '711', name: 'Sprzedaż towarów' },
  { number: '712', name: 'Dzierżawa' },
  { number: '713', name: 'Przychód ze sprzedaży' },
  { number: '714', name: 'Pensje, emerytury' },
  { number: '715', name: 'Zwroty' },
  { number: '716', name: 'Usługi' },
  { number: '717', name: 'Inne' },
  { number: '718', name: 'Rekolektanci' },
  { number: '719', name: 'Dzierżawa przechodnia' },
  { number: '720', name: 'Ofiary' },
  { number: '721', name: 'Darowizny' },
  { number: '722', name: 'Pensje katechetów' },
  { number: '725', name: 'Nadzwyczajne' },
  { number: '727', name: 'Ogród' },
  { number: '728', name: 'Gospodarstwo' },
  { number: '730', name: 'Sprzedaż majątku trwałego' },
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

  // Oblicz sumę tylko dla kont 7xx
  const calculated7xxTotal = INCOME_ACCOUNTS.reduce((sum, acc) => {
    return sum + getAccountAmount(acc.number);
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
            <TableCell className="text-right font-mono">{formatCurrency(calculated7xxTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export { INCOME_ACCOUNTS };
export default ReportIncomeSection;
