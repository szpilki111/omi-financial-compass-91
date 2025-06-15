
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, X, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  date: string;
  document_number: string;
  description: string;
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  settlement_type: string;
  document_id: string | null;
  document?: {
    id: string;
    document_number: string;
    document_name: string;
  };
  debitAccount?: Account;
  creditAccount?: Account;
}

interface TransactionsListProps {
  transactions: Transaction[];
  selectedAccount: Account;
  isLoading: boolean;
  onEditDocument: (documentId: string) => void;
  selectedMonth: number | null;
  onClearMonthFilter: () => void;
}

const TransactionsList: React.FC<TransactionsListProps> = ({
  transactions,
  selectedAccount,
  isLoading,
  onEditDocument,
  selectedMonth,
  onClearMonthFilter,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Operacje na koncie {selectedAccount.number}
            {selectedMonth && (
              <Badge variant="outline" className="ml-2">
                {monthNames[selectedMonth - 1]}
              </Badge>
            )}
          </CardTitle>
          {selectedMonth && (
            <Button variant="ghost" size="sm" onClick={onClearMonthFilter} className="flex items-center gap-1">
              <X className="h-3 w-3" />
              Usuń filtr miesiąca
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Brak operacji do wyświetlenia
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Konto przeciwstawne</TableHead>
                  <TableHead className="text-right">Debet</TableHead>
                  <TableHead className="text-right">Kredyt</TableHead>
                  <TableHead>Rozrachunek</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  const isDebit = transaction.debit_account_id === selectedAccount.id;
                  const oppositeAccount = isDebit ? transaction.creditAccount : transaction.debitAccount;
                  
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(parseISO(transaction.date), 'dd.MM.yyyy', { locale: pl })}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{transaction.document_number}</div>
                          {transaction.document && (
                            <div className="text-xs text-gray-500">
                              {transaction.document.document_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={transaction.description}>
                          {transaction.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        {oppositeAccount && (
                          <div>
                            <div className="font-medium">{oppositeAccount.number}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {oppositeAccount.name}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {isDebit ? (
                          <span className="text-red-600 font-semibold">
                            {transaction.amount.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {!isDebit ? (
                          <span className="text-green-600 font-semibold">
                            {transaction.amount.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {transaction.settlement_type || 'Brak'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.document_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditDocument(transaction.document_id!)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            Edytuj
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionsList;
