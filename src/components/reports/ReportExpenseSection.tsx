import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Nowa lista kont rozchodów - tylko 4xx zgodnie z planem
const EXPENSE_ACCOUNTS = [
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
  { number: '431', name: 'Książki, czasopisma' },
  { number: '435', name: 'Wakacje' },
  { number: '440', name: 'Żywność dodatkowa' },
  { number: '441', name: 'Salon' },
  { number: '442', name: 'Odzież dodatkowa' },
  { number: '443', name: 'Pralnia' },
  { number: '444', name: 'Energia, woda' },
  { number: '445', name: 'Podatki dodatkowe' },
  { number: '446', name: 'Ogród' },
  { number: '447', name: 'Gospodarstwo' },
  { number: '449', name: 'Zakup towarów do sprzedaży' },
  { number: '450', name: 'Różne wydatki' },
  { number: '451', name: 'Remonty zwyczajne' },
  { number: '452', name: 'Remonty nadzwyczajne' },
  { number: '453', name: 'Spotkania, zjazdy' },
  { number: '455', name: 'Studia' },
  { number: '456', name: 'Powołania' },
  { number: '457', name: 'Apostolat' },
  { number: '458', name: 'Biedni' },
  { number: '459', name: 'Misje' },
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
}

export const ReportExpenseSection: React.FC<ReportExpenseSectionProps> = ({
  accountsData,
  totalExpense,
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

  // Oblicz sumę tylko dla kont 4xx
  const calculated4xxTotal = EXPENSE_ACCOUNTS.reduce((sum, acc) => {
    return sum + getAccountAmount(acc.number);
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

export { EXPENSE_ACCOUNTS };
export default ReportExpenseSection;
