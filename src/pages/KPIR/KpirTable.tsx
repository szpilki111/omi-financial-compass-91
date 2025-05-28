
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
import { Pencil } from 'lucide-react';
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

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Nr dokumentu</TableHead>
            <TableHead>Opis</TableHead>
            <TableHead>Kwota</TableHead>
            <TableHead>Konta</TableHead>
            <TableHead>Forma rozrachunku</TableHead>
            <TableHead>Waluta</TableHead>
            {!isAdmin && <TableHead>Akcje</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} className="hover:bg-omi-100">
              <TableCell>{transaction.formattedDate}</TableCell>
              <TableCell>{transaction.document_number || '-'}</TableCell>
              <TableCell>{transaction.description}</TableCell>
              <TableCell className="font-semibold">
                {transaction.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                {transaction.currency !== 'PLN' && ` ${transaction.currency}`}
              </TableCell>
              <TableCell>
                {transaction.debitAccount?.number}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default KpirTable;
