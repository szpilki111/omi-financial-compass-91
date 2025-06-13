
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
import { Pencil, Split, CornerDownRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface KpirTableProps {
  transactions: KpirTransaction[];
  loading: boolean;
  onEditTransaction?: (transaction: KpirTransaction) => void;
}

const KpirTable: React.FC<KpirTableProps> = ({ transactions, loading, onEditTransaction }) => {
  const { user } = useAuth();
  
  // Sprawdź, czy użytkownik jest adminem lub prowincjałem (nie może edytować operacji)
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // Group transactions to show parent-child relationships
  const groupedTransactions = React.useMemo(() => {
    const grouped: { [key: string]: KpirTransaction[] } = {};
    const parentTransactions: KpirTransaction[] = [];
    
    transactions.forEach(transaction => {
      if (transaction.parent_transaction_id) {
        // This is a sub-transaction
        if (!grouped[transaction.parent_transaction_id]) {
          grouped[transaction.parent_transaction_id] = [];
        }
        grouped[transaction.parent_transaction_id].push(transaction);
      } else {
        // This is either a normal transaction or a parent of split transactions
        parentTransactions.push(transaction);
      }
    });
    
    return { grouped, parentTransactions };
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-10 text-omi-gray-500">
        Brak operacji do wyświetlenia
      </div>
    );
  }

  const renderTransactionRow = (transaction: KpirTransaction, isSubTransaction = false, isLast = false) => (
    <TableRow key={transaction.id} className={`hover:bg-omi-100 ${isSubTransaction ? 'bg-blue-50/30' : ''}`}>
      <TableCell>
        <div className="flex items-center">
          {isSubTransaction && (
            <div className="flex items-center mr-3 text-blue-600">
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-blue-300"></div>
                <div className="flex items-center">
                  <div className={`w-4 h-px bg-blue-300 ${!isLast ? '' : ''}`}></div>
                  <CornerDownRight className="h-4 w-4 ml-1 text-blue-500" />
                </div>
                {!isLast && <div className="w-px h-4 bg-blue-300"></div>}
              </div>
            </div>
          )}
          {transaction.formattedDate}
        </div>
      </TableCell>
      <TableCell>{transaction.document_number || '-'}</TableCell>
      <TableCell>
        <div className="flex items-center">
          {transaction.is_split_transaction && !isSubTransaction && (
            <Split className="h-4 w-4 text-orange-500 mr-2" />
          )}
          {transaction.description}
        </div>
      </TableCell>
      <TableCell>
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
      </TableCell>
      <TableCell>
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
            {!isAdmin && <TableHead>Akcje</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedTransactions.parentTransactions.map((transaction) => {
            const subTransactions = groupedTransactions.grouped[transaction.id] || [];
            
            return (
              <React.Fragment key={transaction.id}>
                {renderTransactionRow(transaction)}
                {subTransactions.map((subTransaction, index) => 
                  renderTransactionRow(subTransaction, true, index === subTransactions.length - 1)
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default KpirTable;
