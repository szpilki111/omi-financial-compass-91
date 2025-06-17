
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
}

const DocumentTable: React.FC<DocumentTableProps> = ({ 
  transactions, 
  loading, 
  onEdit, 
  onDelete, 
  onCopy, 
  onSplit 
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

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

  const formatAmount = (amount: number, currency: string = 'PLN') => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

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
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} className="hover:bg-omi-100">
              <TableCell>{transaction.description}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    Wn: {transaction.debitAccount?.number} - {transaction.debitAccount?.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    Ma: {transaction.creditAccount?.number} - {transaction.creditAccount?.name}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatAmount(transaction.debit_amount || transaction.amount, transaction.currency)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatAmount(transaction.credit_amount || transaction.amount, transaction.currency)}
              </TableCell>
              <TableCell>{transaction.currency}</TableCell>
              <TableCell>{transaction.settlement_type}</TableCell>
              <TableCell>
                <div className="flex space-x-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(transaction)}
                      title="Edytuj"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onCopy && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onCopy(transaction)}
                      title="Kopiuj"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  {onSplit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSplit(transaction)}
                      title="Podziel"
                    >
                      <Split className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(transaction.id!)}
                      title="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DocumentTable;
