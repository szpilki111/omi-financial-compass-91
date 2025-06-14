
import React from "react";
import { Button } from "@/components/ui/button";
import { KpirTransaction } from "@/types/kpir";
import { Spinner } from "@/components/ui/Spinner";
import { Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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
  onShowDocument,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "prowincjal" || user?.role === "admin";

  const groupedTransactions = React.useMemo(() => {
    const grouped: { [key: string]: KpirTransaction[] } = {};
    const splitParentIds = new Set<string>();
    const parentTransactions: KpirTransaction[] = [];

    transactions.forEach((transaction) => {
      if (transaction.parent_transaction_id) {
        if (!grouped[transaction.parent_transaction_id]) {
          grouped[transaction.parent_transaction_id] = [];
        }
        grouped[transaction.parent_transaction_id].push(transaction);
        splitParentIds.add(transaction.parent_transaction_id);
      }
    });

    transactions.forEach((transaction) => {
      if (!transaction.parent_transaction_id) {
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

  // Kartowy widok poj. transakcji
  const renderTransactionCard = (
    transaction: KpirTransaction,
    isSub = false
  ) => {
    const subTransactions = groupedTransactions.grouped[transaction.id] || [];
    const isSplitParent = subTransactions.length > 0;

    // Dane do wyświetlenia strony Winien
    const winienInfo = (t: KpirTransaction) =>
      t.debit_amount !== undefined && t.debit_amount > 0
        ? {
            amount: t.debit_amount,
            account:
              t.debitAccount?.number ||
              "",
          }
        : t.amount > 0 && t.debitAccount
        ? {
            amount: t.amount,
            account: t.debitAccount.number,
          }
        : null;

    // Dane do wyświetlenia strony Ma
    const maInfo = (t: KpirTransaction) =>
      t.credit_amount !== undefined && t.credit_amount > 0
        ? {
            amount: t.credit_amount,
            account:
              t.creditAccount?.number ||
              "",
          }
        : t.amount > 0 && t.creditAccount
        ? {
            amount: t.amount,
            account: t.creditAccount.number,
          }
        : null;

    return (
      <React.Fragment key={transaction.id}>
        <div
          className={`bg-white rounded-xl shadow-sm border mb-2 p-4 ${isSub ? "ml-8 bg-blue-50/40" : ""}`}
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
            <div className="flex-1 min-w-0">
              {/* Opis transakcji */}
              {transaction.description && (
                <div className="font-medium text-gray-900 mb-1">
                  {transaction.description}
                </div>
              )}
              {/* Ma i Winien */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {winienInfo(transaction) && (
                  <span className="text-green-700 font-semibold">
                    Winien:{" "}
                    {winienInfo(transaction)!.amount.toLocaleString("pl-PL", {
                      style: "currency",
                      currency: transaction.currency || "PLN",
                      minimumFractionDigits: 2,
                    })}
                    {winienInfo(transaction)!.account && (
                      <span className="text-gray-700 font-normal ml-1 text-xs">
                        {" "}
                        &rarr; {winienInfo(transaction)!.account}
                      </span>
                    )}
                  </span>
                )}
                {maInfo(transaction) && (
                  <span className="text-blue-700 font-semibold">
                    Ma:{" "}
                    {maInfo(transaction)!.amount.toLocaleString("pl-PL", {
                      style: "currency",
                      currency: transaction.currency || "PLN",
                      minimumFractionDigits: 2,
                    })}
                    {maInfo(transaction)!.account && (
                      <span className="text-gray-700 font-normal ml-1 text-xs">
                        {" "}
                        &rarr; {maInfo(transaction)!.account}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {/* Numer i data dokumentu */}
              <div className="flex flex-wrap items-center mt-1 text-xs text-gray-500 gap-x-4">
                {transaction.document_number && (
                  <span>Dokument: {transaction.document_number}</span>
                )}
                {transaction.formattedDate && (
                  <span>{transaction.formattedDate}</span>
                )}
                {transaction.settlement_type && (
                  <span>{transaction.settlement_type}</span>
                )}
                {transaction.currency && (
                  <span>
                    {transaction.currency !== "PLN" && transaction.exchange_rate
                      ? `kurs: ${transaction.exchange_rate.toFixed(4)}`
                      : transaction.currency}
                  </span>
                )}
              </div>
            </div>
            {/* Akcje */}
            <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">
              {transaction.document && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onShowDocument?.(transaction.document)}
                  title="Podgląd dokumentu"
                  className="text-blue-700"
                >
                  {/* Lupa */}
                  <span className="sr-only">Podgląd dokumentu</span>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </Button>
              )}
              {!isAdmin && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onEditTransaction?.(transaction)}
                  className="h-8 w-8 p-0"
                  title="Edytuj"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {/* Renderuj subtransakcje jeśli są */}
        {subTransactions.map((sub, idx) =>
          renderTransactionCard(sub, true)
        )}
      </React.Fragment>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <span className="text-base font-semibold text-gray-900">Operacje</span>
      </div>
      <div>
        {groupedTransactions.parentTransactions
          .map((transaction) => renderTransactionCard(transaction))}
      </div>
    </div>
  );
};

export default KpirTable;

