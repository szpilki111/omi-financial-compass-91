import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Split } from 'lucide-react';
import { Transaction } from './types';
import { format } from 'date-fns';

interface DocumentTableProps {
  documentId: string;
  onTransactionEdit: (transaction: Transaction) => void;
  onTransactionDelete: (transactionId: string) => void;
  onTransactionSplit: (transaction: Transaction) => void;
  isEditingBlocked?: boolean;
}

const DocumentTable: React.FC<DocumentTableProps> = ({
  documentId,
  onTransactionEdit,
  onTransactionDelete,
  onTransactionSplit,
  isEditingBlocked = false,
}) => {
  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ['transactions', documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          debitAccount:debit_account_id(number, name),
          creditAccount:credit_account_id(number, name)
        `)
        .eq('document_id', documentId)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching transactions:', error);
        throw error;
      }

      // Transform the data to match the Transaction interface
      return data?.map(item => ({
        ...item,
        debitAccount: item.debitAccount && 
                     typeof item.debitAccount === 'object' && 
                     item.debitAccount !== null &&
                     'number' in item.debitAccount &&
                     'name' in item.debitAccount
          ? { 
              number: item.debitAccount.number as string, 
              name: item.debitAccount.name as string 
            }
          : undefined,
        creditAccount: item.creditAccount && 
                      typeof item.creditAccount === 'object' && 
                      item.creditAccount !== null &&
                      'number' in item.creditAccount &&
                      'name' in item.creditAccount
          ? { 
              number: item.creditAccount.number as string, 
              name: item.creditAccount.name as string 
            }
          : undefined,
      })) as Transaction[];
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Ładowanie...</div>;
  }

  if (error) {
    return <div className="text-center py-4">Błąd: {error.message}</div>;
  }

  const debitTotal = transactions?.reduce((sum, transaction) => {
    return sum + (transaction.debit_amount !== undefined ? transaction.debit_amount : transaction.amount);
  }, 0) || 0;

  const creditTotal = transactions?.reduce((sum, transaction) => {
    return sum + (transaction.credit_amount !== undefined ? transaction.credit_amount : transaction.amount);
  }, 0) || 0;

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Opis</TableHead>
            <TableHead>Konto Winien</TableHead>
            <TableHead>Konto Ma</TableHead>
            <TableHead className="text-right">Kwota Winien</TableHead>
            <TableHead className="text-right">Kwota Ma</TableHead>
            <TableHead className="text-right">Waluta</TableHead>
            <TableHead className="text-center">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions?.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{transaction.date ? format(new Date(transaction.date), 'dd.MM.yyyy') : ''}</TableCell>
              <TableCell>{transaction.description}</TableCell>
              <TableCell>
                {transaction.debitAccount 
                  ? `${transaction.debitAccount.number} - ${transaction.debitAccount.name}`
                  : ''
                }
              </TableCell>
              <TableCell>
                {transaction.creditAccount 
                  ? `${transaction.creditAccount.number} - ${transaction.creditAccount.name}`
                  : ''
                }
              </TableCell>
              <TableCell className="text-right">
                {transaction.debit_amount !== undefined ? transaction.debit_amount.toFixed(2) : transaction.amount?.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {transaction.credit_amount !== undefined ? transaction.credit_amount.toFixed(2) : transaction.amount?.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">{transaction.currency}</TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTransactionEdit(transaction)}
                    disabled={isEditingBlocked}
                    title={isEditingBlocked ? "Edycja zablokowana - raport złożony" : "Edytuj operację"}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTransactionSplit(transaction)}
                    disabled={isEditingBlocked}
                    title={isEditingBlocked ? "Dzielenie zablokowane - raport złożony" : "Podziel operację"}
                  >
                    <Split className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTransactionDelete(transaction.id!)}
                    disabled={isEditingBlocked}
                    title={isEditingBlocked ? "Usuwanie zablokowane - raport złożony" : "Usuń operację"}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end space-x-4 p-4">
        <div className="font-bold">
          Suma Winien: {debitTotal.toFixed(2)}
        </div>
        <div className="font-bold">
          Suma Ma: {creditTotal.toFixed(2)}
        </div>
      </div>

      {transactions && transactions.length === 0 && (
        <div className="text-center py-4">Brak transakcji dla tego dokumentu.</div>
      )}
    </div>
  );
};

export default DocumentTable;
