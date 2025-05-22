
import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import { KpirTransaction } from '@/types/kpir';
import { Spinner } from '@/components/ui/Spinner';

interface KpirTableProps {
  transactions: KpirTransaction[];
  loading: boolean;
}

const KpirTable: React.FC<KpirTableProps> = ({ transactions, loading }) => {
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default KpirTable;
