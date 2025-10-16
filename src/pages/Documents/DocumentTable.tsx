
import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell,
  TableFooter
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Transaction } from './types';
import { Pencil, Trash2, Copy, Split } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';

interface DocumentTableProps {
  transactions: Transaction[];
  loading: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  onCopy?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  documentCurrency?: string;
}

const DocumentTable: React.FC<DocumentTableProps> = ({ 
  transactions, 
  loading, 
  onEdit, 
  onDelete, 
  onCopy, 
  onSplit,
  documentCurrency = 'PLN'
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // Budujemy strukturę transakcji z subtransakcjami
  const transactionsWithSubs = React.useMemo(() => {
    const mainTransactions = transactions.filter(transaction => 
      !transaction.parent_transaction_id
    );

    return mainTransactions.map(mainTx => {
      const subTransactions = transactions.filter(t => 
        t.parent_transaction_id === mainTx.id
      );
      return { main: mainTx, subs: subTransactions };
    });
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-10 text-omi-gray-500">
        Brak operacji do wyświetlenia
      </div>
    );
  }

  const getCurrencySymbol = (currency: string = 'PLN') => {
    const currencySymbols: { [key: string]: string } = {
      'PLN': 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr',
      'SEK': 'kr',
    };
    return currencySymbols[currency] || currency;
  };

  const formatAmount = (amount: number, currency: string = 'PLN') => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toLocaleString('pl-PL', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })} ${symbol}`;
  };

  const getAccountDisplay = (accountNumber: string | undefined, account: any, accountId: string | undefined) => {
    const number = accountNumber || account?.number || 'N/A';
    const name = account?.name || 'N/A';
    
    console.log('Account display debug:', { accountNumber, account, accountId, number, name });
    
    return `${number} - ${name}`;
  };

  // Calculate sums - only from main transactions to avoid double counting
  const debitSum = transactionsWithSubs.reduce((sum, { main }) => {
    const debitAmount = main.debit_amount !== undefined ? main.debit_amount : main.amount;
    return sum + (debitAmount || 0);
  }, 0);

  const creditSum = transactionsWithSubs.reduce((sum, { main }) => {
    const creditAmount = main.credit_amount !== undefined ? main.credit_amount : main.amount;
    return sum + (creditAmount || 0);
  }, 0);

  // In double-entry bookkeeping, debits should equal credits, so we show the difference as balance
  const balance = Math.abs(debitSum - creditSum);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opis</TableHead>
            <TableHead>Konta</TableHead>
            <TableHead className="text-right">Winien</TableHead>
            <TableHead className="text-right">Ma</TableHead>
            <TableHead>Waluta</TableHead>
            <TableHead>Typ rozliczenia</TableHead>
            <TableHead>Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactionsWithSubs.map(({ main, subs }) => (
            <React.Fragment key={main.id}>
              <TableRow className="hover:bg-omi-100">
                <TableCell>{main.description}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      Wn: {getAccountDisplay(main.debitAccountNumber, main.debitAccount, main.debit_account_id)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Ma: {getAccountDisplay(main.creditAccountNumber, main.creditAccount, main.credit_account_id)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(main.debit_amount || main.amount, documentCurrency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(main.credit_amount || main.amount, documentCurrency)}
                </TableCell>
                <TableCell>{getCurrencySymbol(documentCurrency)}</TableCell>
                <TableCell>{main.settlement_type}</TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(main)}
                        title="Edytuj"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {onCopy && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCopy(main)}
                        title="Kopiuj"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {onSplit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSplit(main)}
                        title="Podziel"
                      >
                        <Split className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(main.id!)}
                        title="Usuń"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {subs.map((sub) => (
                <TableRow key={`${main.id}-${sub.clonedType}`} className="bg-blue-50/50 hover:bg-blue-100/50">
                  <TableCell>
                    <div className="pl-6 text-sm italic">{sub.description}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        Wn: {getAccountDisplay(sub.debitAccountNumber, sub.debitAccount, sub.debit_account_id)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Ma: {getAccountDisplay(sub.creditAccountNumber, sub.creditAccount, sub.credit_account_id)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(sub.debit_amount || sub.amount, documentCurrency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(sub.credit_amount || sub.amount, documentCurrency)}
                  </TableCell>
                  <TableCell>{getCurrencySymbol(documentCurrency)}</TableCell>
                  <TableCell>{sub.settlement_type}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(sub)}
                          title="Edytuj"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(sub.id!)}
                          title="Usuń"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-gray-50 font-medium">
            <TableCell colSpan={2} className="text-right font-bold">
              RAZEM:
            </TableCell>
            <TableCell className="text-right font-bold text-lg">
              {formatAmount(debitSum, documentCurrency)}
            </TableCell>
            <TableCell className="text-right font-bold text-lg">
              {formatAmount(creditSum, documentCurrency)}
            </TableCell>
            <TableCell colSpan={3} className="text-left font-bold text-lg">
              {debitSum === creditSum ? (
                <span className="text-green-600">Bilans się zgadza ✓</span>
              ) : (
                <span className="text-red-600">Różnica: {formatAmount(balance, documentCurrency)}</span>
              )}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export default DocumentTable;
