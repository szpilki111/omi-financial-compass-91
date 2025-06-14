
import React from 'react';
import { KpirTransaction } from '@/types/kpir';
import { Spinner } from '@/components/ui/Spinner';
import KpirTransactionCard from './KpirTransactionCard';

interface KpirTableProps {
  transactions: KpirTransaction[];
  loading: boolean;
  onEditTransaction?: (transaction: KpirTransaction) => void;
  onShowDocument?: (doc: KpirTransaction["document"]) => void;
}

const KpirTable: React.FC<KpirTableProps> = ({ 
  transactions, 
  loading, 
  onEditTransaction, 
  onShowDocument 
}) => {
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

  const renderTransactionGroup = (transaction: KpirTransaction) => {
    const subTransactions = groupedTransactions.grouped[transaction.id] || [];
    const isSplitParent = subTransactions.length > 0;

    return (
      <div key={transaction.id} className="space-y-2">
        {/* Main transaction card */}
        <KpirTransactionCard
          transaction={transaction}
          onEditTransaction={onEditTransaction}
          onShowDocument={onShowDocument}
        />
        
        {/* Sub-transactions if any */}
        {subTransactions.map((subTransaction, index) => (
          <KpirTransactionCard
            key={subTransaction.id}
            transaction={subTransaction}
            onEditTransaction={onEditTransaction}
            onShowDocument={onShowDocument}
            isSubTransaction={true}
            isLastSubTransaction={index === subTransactions.length - 1}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {groupedTransactions.parentTransactions.map(transaction => 
        renderTransactionGroup(transaction)
      )}
    </div>
  );
};

export default KpirTable;
