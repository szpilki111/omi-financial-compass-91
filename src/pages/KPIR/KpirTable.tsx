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
  onShowDocument?: (doc: KpirTransaction["document"]) => void;
}

const KpirTable: React.FC<KpirTableProps> = ({ transactions, loading, onEditTransaction, onShowDocument }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // ZGRUPOWANIE: podpinamy subtransakcje do rodzica, a jako główne pokazujemy
  // tylko te, które NIE są rodzicem splitów lub nie mają subtransakcji
  const groupedTransactions = React.useMemo(() => {
    const grouped: { [key: string]: KpirTransaction[] } = {};
    // Rodzice splitów (czyli transakcje które mają pod-transakcje)
    const splitParentIds = new Set<string>();
    // Min. lista rodziców
    const parentTransactions: KpirTransaction[] = [];

    // Grupuj subtransakcje
    transactions.forEach(transaction => {
      if (transaction.parent_transaction_id) {
        if (!grouped[transaction.parent_transaction_id]) {
          grouped[transaction.parent_transaction_id] = [];
        }
        grouped[transaction.parent_transaction_id].push(transaction);
        splitParentIds.add(transaction.parent_transaction_id);
      }
    });

    // FILTRUJEMY: NIE pokazujemy "głównych" splitów (czyli takich, które są rodzicem pod-transakcji)
    transactions.forEach(transaction => {
      if (!transaction.parent_transaction_id) {
        // Jeśli NIE jest splitem z subtransakcjami => pokaż normalnie
        if (!splitParentIds.has(transaction.id)) {
          parentTransactions.push(transaction);
        } else {
          // Jeśli jest split-parentem, dodajemy go żeby był nagłówkiem dla subtransakcji (ale bez kwot!)
          parentTransactions.push(transaction);
        }
      }
    });

    return { grouped, parentTransactions, splitParentIds };
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

  // Modyfikacja: Jeśli dana transakcja jest parentem split (ma subtransakcje), NIE pokazujemy jej kwot, tylko opis/nr i podpinamy pod nią subtransakcje
  const renderParentTransactionRow = (transaction: KpirTransaction) => {
    const subTransactions = groupedTransactions.grouped[transaction.id] || [];
    const isSplitParent = subTransactions.length > 0;

    return (
      <React.Fragment key={transaction.id}>
        <TableRow className="hover:bg-omi-100">
          <TableCell>{transaction.formattedDate}</TableCell>
          <TableCell>{transaction.document_number || '-'}</TableCell>
          <TableCell>
            <div className="flex items-center">
              {isSplitParent && (
                <Split className="h-4 w-4 text-orange-500 mr-2" />
              )}
              {transaction.description}
            </div>
          </TableCell>
          {/* KWOTY oraz konta - pokazujemy TYLKO jeśli NIE jest splitem z subtransakcjami */}
          {isSplitParent ? (
            <>
              <TableCell colSpan={2} className="text-xs text-gray-400 italic text-center">
                <span>Podzielona transakcja – kwoty poniżej</span>
              </TableCell>
            </>
          ) : (
            <>
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
            </>
          )}
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
                {/* Ikona search (lupa) */}
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
        {/* Renderuj subtransakcje jeżeli istnieją */}
        {subTransactions.map((subTransaction, index) =>
          renderSubTransactionRow(subTransaction, index === subTransactions.length - 1)
        )}
      </React.Fragment>
    );
  };

  const renderSubTransactionRow = (subTransaction: KpirTransaction, isLast = false) => (
    <TableRow key={subTransaction.id} className="hover:bg-omi-100 bg-blue-50/30">
      <TableCell>
        <div className="flex items-center pl-8">
          <div className="flex items-center mr-3 text-blue-600">
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-blue-300"></div>
              <div className="flex items-center">
                <div className="w-6 h-px bg-blue-300"></div>
                <CornerDownRight className="h-4 w-4 ml-1 text-blue-500" />
              </div>
              {!isLast && <div className="w-px h-4 bg-blue-300"></div>}
            </div>
          </div>
          <span className="text-sm text-gray-600">{subTransaction.formattedDate}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="pl-8 text-sm text-gray-600">
          {subTransaction.document_number || '-'}
        </div>
      </TableCell>
      <TableCell>
        <div className="pl-8 text-sm">
          {subTransaction.description}
        </div>
      </TableCell>
      {/* Pokaż stronę Winien tylko jeśli debit_amount > 0 */}
      <TableCell>
        <div className="pl-8 space-y-1">
          {(typeof subTransaction.debit_amount === 'number' && subTransaction.debit_amount > 0) && (
            <>
              <div className="font-semibold text-green-700">
                <span className="text-xs text-gray-500 mr-1">Wn:</span>
                <span className="font-mono">
                  {subTransaction.debit_amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                  {subTransaction.currency !== 'PLN' && ` ${subTransaction.currency}`}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {subTransaction.debitAccount?.number} - {subTransaction.debitAccount?.name}
              </div>
            </>
          )}
        </div>
      </TableCell>
      {/* Pokaż stronę Ma tylko jeśli credit_amount > 0 */}
      <TableCell>
        <div className="pl-8 space-y-1">
          {(typeof subTransaction.credit_amount === 'number' && subTransaction.credit_amount > 0) && (
            <>
              <div className="font-semibold text-red-700">
                <span className="text-xs text-gray-500 mr-1">Ma:</span>
                <span className="font-mono">
                  {subTransaction.credit_amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}
                  {subTransaction.currency !== 'PLN' && ` ${subTransaction.currency}`}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {subTransaction.creditAccount?.number} - {subTransaction.creditAccount?.name}
              </div>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="pl-8 text-sm">{subTransaction.settlement_type}</div>
      </TableCell>
      <TableCell>
        <div className="pl-8 text-sm">
          {subTransaction.currency}
          {subTransaction.currency !== 'PLN' && subTransaction.exchange_rate && (
            <span className="text-xs text-omi-gray-500 block">
              kurs: {subTransaction.exchange_rate.toFixed(4)}
            </span>
          )}
        </div>
      </TableCell>
      {!isAdmin && (
        <TableCell>
          <div className="pl-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditTransaction?.(subTransaction)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
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
            <TableHead>Dokument</TableHead>
            {!isAdmin && <TableHead>Akcje</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedTransactions.parentTransactions
            // Ostateczna filtracja: jeśli dany rodzic jest split-parentem, pokazujemy go tylko raz z subtransakcjami (patrz wyżej)
            .filter(transaction => {
              // Jeśli jest split-parentem (ma subtransakcje), renderujemy go tylko raz razem z subtransakcjami
              // (dzięki temu nie ma podwojeń)
              return true;
            })
            .map(transaction => renderParentTransactionRow(transaction))
          }
        </TableBody>
      </Table>
    </div>
  );
};

export default KpirTable;
