import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Predefiniowana lista kont rozchodów zgodna ze wzorem raportu
const EXPENSE_ACCOUNTS = [
  { number: '210', name: 'Intencje odprawione i oddane' },
  { number: '212', name: 'Udzielone pożyczki' },
  { number: '215', name: 'Spłata pożyczek' },
  { number: '217', name: 'Sumy przechodnie' },
  { number: '225', name: 'Zakup towarów' },
  { number: '401', name: 'Żywność' },
  { number: '402', name: 'Alkohol' },
  { number: '403', name: 'Opłaty za energię' },
  { number: '404', name: 'Opłaty telefoniczne' },
  { number: '405', name: 'Opłaty komunalne' },
  { number: '406', name: 'Transport' },
  { number: '407', name: 'Opłaty administracyjne' },
  { number: '408', name: 'Ubezpieczenia' },
  { number: '409', name: 'Remonty, naprawy' },
  { number: '410', name: 'Wyposażenie' },
  { number: '411', name: 'Materiały biurowe' },
  { number: '412', name: 'Prenumerata, książki' },
  { number: '413', name: 'Środki czystości' },
  { number: '414', name: 'Odzież' },
  { number: '415', name: 'Leczenie' },
  { number: '416', name: 'Formacja, studia' },
  { number: '417', name: 'Duszpasterstwo' },
  { number: '418', name: 'Podróże służbowe' },
  { number: '419', name: 'Urlopy, rekolekcje' },
  { number: '420', name: 'Reprezentacja' },
  { number: '421', name: 'Wynagrodzenia' },
  { number: '422', name: 'ZUS' },
  { number: '423', name: 'Usługi obce' },
  { number: '424', name: 'Inwestycje' },
  { number: '425', name: 'Wydatki bankowe' },
  { number: '430', name: 'Podatki' },
  { number: '450', name: 'Różne wydatki' },
  { number: '458', name: 'Inne koszty' },
];

// Podsekcja świadczeń na prowincję
const PROVINCE_SETTLEMENTS = [
  { name: 'Kontybucje' },
  { name: 'Duszpasterstwo OMI 60%' },
  { name: 'ZUS OMI' },
  { name: 'Fundusz ubezpieczeniowy' },
  { name: 'Dzierżawa 20%' },
  { name: 'Składka medialna' },
  { name: 'Składka misyjna' },
  { name: 'Formacja' },
  { name: 'Inne świadczenia' },
];

interface AccountData {
  accountNumber: string;
  accountName: string;
  amount: number;
}

interface ProvinceSettlementData {
  name: string;
  amount: number;
}

interface ReportExpenseSectionProps {
  accountsData: AccountData[];
  totalExpense: number;
  provinceSettlements?: ProvinceSettlementData[];
  provinceSettlementsTotal?: number;
  className?: string;
}

export const ReportExpenseSection: React.FC<ReportExpenseSectionProps> = ({
  accountsData,
  totalExpense,
  provinceSettlements = [],
  provinceSettlementsTotal = 0,
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
          {EXPENSE_ACCOUNTS.map((account) => {
            const amount = getAccountAmount(account.number);
            return (
              <TableRow key={account.number}>
                <TableCell className="text-center font-mono text-sm">{account.number}</TableCell>
                <TableCell>{account.name}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
              </TableRow>
            );
          })}
          
          {/* Świadczenia na prowincję */}
          <TableRow>
            <TableCell className="text-center font-mono text-sm">201-1-1</TableCell>
            <TableCell className="font-semibold">Świadczenia na prowincję (uregulowane)</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(provinceSettlementsTotal)}</TableCell>
          </TableRow>

          {/* Podsekcja "w tym:" */}
          {provinceSettlements.length > 0 && (
            <>
              <TableRow className="bg-muted/30">
                <TableCell></TableCell>
                <TableCell className="italic text-muted-foreground pl-8">w tym:</TableCell>
                <TableCell></TableCell>
              </TableRow>
              {provinceSettlements.map((settlement, index) => (
                <TableRow key={index} className="bg-muted/20">
                  <TableCell></TableCell>
                  <TableCell className="italic text-muted-foreground pl-12">{settlement.name}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground italic">
                    {formatCurrency(settlement.amount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30">
                <TableCell></TableCell>
                <TableCell className="italic text-muted-foreground pl-8 font-semibold">
                  Świadczenia na prowincję razem:
                </TableCell>
                <TableCell className="text-right font-mono italic">
                  {formatCurrency(provinceSettlementsTotal)}
                </TableCell>
              </TableRow>
            </>
          )}

          {/* Suma rozchodów */}
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell colSpan={2} className="text-right">ROZCHODY RAZEM:</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totalExpense)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportExpenseSection;
