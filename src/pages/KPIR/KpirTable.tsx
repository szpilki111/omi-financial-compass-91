
import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { KpirTransaction } from '@/types/kpir';
import { Spinner } from '@/components/ui/Spinner';
import { Pencil, Split } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface KpirTableProps {
  transactions: KpirTransaction[];
  loading: boolean;
  onEditTransaction?: (transaction: KpirTransaction) => void;
  onShowDocument?: (doc: KpirTransaction["document"]) => void;
}

const KpirTable: React.FC<KpirTableProps> = ({ transactions, loading, onEditTransaction, onShowDocument }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // Filtrujemy tylko operacje główne - ukrywamy sklonowane operacje (subtransakcje)
  const mainTransactions = React.useMemo(() => {
    return transactions.filter(transaction => !transaction.parent_transaction_id);
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!mainTransactions.length) {
    return (
      <div className="text-center py-10 text-omi-gray-500">
        Brak operacji do wyświetlenia
      </div>
    );
  }

  const renderTransactionRow = (transaction: KpirTransaction) => {
    // Sprawdź czy ta transakcja ma subtransakcje (jest split-parentem)
    const hasSubTransactions = transactions.some(t => t.parent_transaction_id === transaction.id);

    return (
      <TableRow key={transaction.id} className="hover:bg-omi-100">
        <TableCell>{transaction.formattedDate}</TableCell>
        <TableCell>{transaction.document_number || '-'}</TableCell>
        <TableCell>
          <div className="flex items-center">
            {hasSubTransactions && (
              <Split className="h-4 w-4 text-orange-500 mr-2" />
            )}
            {transaction.description}
          </div>
        </TableCell>
        <TableCell>
          {typeof transaction.debit_amount === 'number'
            ? (transaction.debit_amount > 0 && (
                <div className="space-y-1">
                  <div className="font-semibold text-green-700">
                    <span className="text-xs text-gray-500 mr-1">Wn:</span>
                    <span className="font-mono">
                      {transaction.debit_amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                      {transaction.currency !== 'PLN' && ` ${transaction.currency}`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {transaction.debitAccount?.number} - {transaction.debitAccount?.name}
                  </div>
                </div>
              ))
            : (transaction.amount > 0 && (
                <div className="space-y-1">
                  <div className="font-semibold text-green-700">
                    <span className="text-xs text-gray-500 mr-1">Wn:</span>
                    <span className="font-mono">
                      {transaction.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                      {transaction.currency !== 'PLN' && ` ${transaction.currency}`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {transaction.debitAccount?.number} - {transaction.debitAccount?.name}
                  </div>
                </div>
              ))
          }
        </TableCell>
        <TableCell>
          {typeof transaction.credit_amount === 'number'
            ? (transaction.credit_amount > 0 && (
                <div className="space-y-1">
                  <div className="font-semibold text-red-700">
                    <span className="text-xs text-gray-500 mr-1">Ma:</span>
                    <span className="font-mono">
                      {transaction.credit_amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                      {transaction.currency !== 'PLN' && ` ${transaction.currency}`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {transaction.creditAccount?.number} - {transaction.creditAccount?.name}
                  </div>
                </div>
              ))
            : (transaction.amount > 0 && (
                <div className="space-y-1">
                  <div className="font-semibold text-red-700">
                    <span className="text-xs text-gray-500 mr-1">Ma:</span>
                    <span className="font-mono">
                      {transaction.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                      {transaction.currency !== 'PLN' && ` ${transaction.currency}`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {transaction.creditAccount?.number} - {transaction.creditAccount?.name}
                  </div>
                </div>
              ))
          }
        </TableCell>
        <TableCell>{transaction.settlement_type}</TableCell>
        <TableCell>
          {transaction.currency}
          {transaction.currency !== 'PLN' && transaction.exchange_rate && (
            <span className="text-xs text-omi-gray-500 block">
              kurs: {transaction.exchange_rate.toFixed(4)}
            </span>
          )}
        </TableCell>
        <TableCell>
          {transaction.document ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShowDocument?.(transaction.document)}
              title="Edytuj dokument"
            >
              <span className="sr-only">Edytuj dokument</span>
              <svg className="h-5 w-5 text-blue-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </Button>
          ) : (
            <span className="text-xs text-gray-400 italic">Brak</span>
          )}
        </TableCell>
        {!isAdmin && (
          <TableCell>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditTransaction?.(transaction)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Nr dokumentu</TableHead>
            <TableHead>Opis</TableHead>
            <TableHead>Strona Wn (Winien)</TableHead>
            <TableHead>Strona Ma</TableHead>
            <TableHead>Forma rozrachunku</TableHead>
            <TableHead>Waluta</TableHead>
            <TableHead>Dokument</TableHead>
            {!isAdmin && <TableHead>Akcje</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {mainTransactions.map(transaction => renderTransactionRow(transaction))}
        </TableBody>
      </Table>
    </div>
  );
};

export default KpirTable;
