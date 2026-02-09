import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Transaction } from "./types";
import { Pencil, Trash2, Copy, Split, GripVertical } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DocumentTableProps {
  transactions: Transaction[];
  loading: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  onCopy?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  onReorder?: (reorderedTransactions: Transaction[]) => void;
  documentCurrency?: string;
}

interface SortableRowProps {
  transaction: Transaction;
  index: number;
  subs: Transaction[];
  documentCurrency: string;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  onCopy?: (transaction: Transaction) => void;
  onSplit?: (transaction: Transaction) => void;
  isAdmin: boolean;
  getCurrencySymbol: (currency: string) => string;
  formatAmount: (amount: number, currency: string) => string;
  getAccountDisplay: (accountNumber: string | undefined, account: any, accountId: string | undefined) => string;
}

const SortableRow: React.FC<SortableRowProps> = ({
  transaction,
  index,
  subs,
  documentCurrency,
  onEdit,
  onDelete,
  onCopy,
  onSplit,
  isAdmin,
  getCurrencySymbol,
  formatAmount,
  getAccountDisplay,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: transaction.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <React.Fragment>
      <TableRow ref={setNodeRef} style={style} className="hover:bg-omi-100">
        <TableCell className="w-10">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </TableCell>
        <TableCell>{transaction.description}</TableCell>
        <TableCell>
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Wn:{" "}
              {getAccountDisplay(
                transaction.debitAccountNumber,
                transaction.debitAccount,
                transaction.debit_account_id,
              )}
            </div>
            <div className="text-sm text-gray-600">
              Ma:{" "}
              {getAccountDisplay(
                transaction.creditAccountNumber,
                transaction.creditAccount,
                transaction.credit_account_id,
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatAmount(transaction.debit_amount || transaction.amount, documentCurrency)}
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatAmount(transaction.credit_amount || transaction.amount, documentCurrency)}
        </TableCell>
        <TableCell>{getCurrencySymbol(documentCurrency)}</TableCell>
        <TableCell>{transaction.settlement_type}</TableCell>
        <TableCell>
          <div className="flex space-x-1">
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(transaction)} title="Edytuj">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onCopy && (
              <Button variant="ghost" size="icon" onClick={() => onCopy(transaction)} title="Kopiuj">
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {onSplit && (
              <Button variant="ghost" size="icon" onClick={() => onSplit(transaction)} title="Podziel">
                <Split className="h-4 w-4" />
              </Button>
            )}
            {onDelete && isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(transaction.id!)} title="Usuń">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {subs.map((sub) => (
        <TableRow key={`${transaction.id}-${sub.clonedType}`} className="bg-blue-50/50 hover:bg-blue-100/50">
          <TableCell></TableCell>
          <TableCell>
            <div className="pl-6 text-sm italic">{sub.description}</div>
          </TableCell>
          <TableCell>
            <div className="space-y-1">
              <div className="text-sm font-medium">
                Wn: {getAccountDisplay(sub.debitAccountNumber, sub.debitAccount, sub.debit_account_id)}
              </div>
              <div className="text-sm text-gray-600">
                Ma: {getAccountDisplay(sub.creditAccountNumber, sub.creditAccount, sub.credit_account_id)}
              </div>
            </div>
          </TableCell>
          <TableCell className="text-right font-medium">
            {formatAmount(sub.debit_amount || sub.amount, documentCurrency)}
          </TableCell>
          <TableCell className="text-right font-medium">
            {formatAmount(sub.credit_amount || sub.amount, documentCurrency)}
          </TableCell>
          <TableCell>{getCurrencySymbol(documentCurrency)}</TableCell>
          <TableCell>{sub.settlement_type}</TableCell>
          <TableCell>
            <div className="flex space-x-1">
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(sub)} title="Edytuj">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => onDelete(sub.id!)} title="Usuń">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </React.Fragment>
  );
};

const DocumentTable: React.FC<DocumentTableProps> = ({
  transactions,
  loading,
  onEdit,
  onDelete,
  onCopy,
  onSplit,
  onReorder,
  documentCurrency = "PLN",
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "prowincjal" || user?.role === "admin";

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Budujemy strukturę transakcji z subtransakcjami
  const transactionsWithSubs = React.useMemo(() => {
    const mainTransactions = transactions.filter((transaction) => !transaction.isCloned);

    return mainTransactions.map((mainTx) => {
      const subTransactions = transactions.filter((t) => t.isCloned && t.clonedType && mainTx.id === t.id);
      return { main: mainTx, subs: subTransactions };
    });
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return <div className="text-center py-10 text-omi-gray-500">Brak operacji do wyświetlenia</div>;
  }

  const getCurrencySymbol = (currency: string = "PLN") => {
    const symbols: { [key: string]: string } = {
      PLN: "zł",
      EUR: "€",
      USD: "$",
      CAD: "CAD",
      NOK: "NOK",
      AUD: "AUD",
    };
    return currencySymbols[currency] || currency;
  };

  const formatAmount = (amount: number, currency: string = "PLN") => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${symbol}`;
  };

  const getAccountDisplay = (accountNumber: string | undefined, account: any, accountId: string | undefined) => {
    const number = accountNumber || account?.number || "N/A";
    const name = account?.name || "N/A";

    console.log("Account display debug:", { accountNumber, account, accountId, number, name });

    return `${number} - ${name}`;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = transactionsWithSubs.findIndex(({ main }) => main.id === active.id);
      const newIndex = transactionsWithSubs.findIndex(({ main }) => main.id === over.id);

      const reorderedWithSubs = arrayMove(transactionsWithSubs, oldIndex, newIndex);

      // Flatten back to a single array maintaining the order
      const reorderedTransactions = reorderedWithSubs.flatMap(({ main, subs }) => [main, ...subs]);

      if (onReorder) {
        onReorder(reorderedTransactions);
      }
    }
  };

  // Calculate sums - only from main transactions to avoid double counting
  const debitSum = transactionsWithSubs.reduce((sum, { main }) => {
    const debitAmount = main.debit_amount !== undefined ? main.debit_amount : main.amount;
    return sum + (debitAmount || 0);
  }, 0);

  const creditSum = transactionsWithSubs.reduce((sum, { main }) => {
    const creditAmount = main.credit_amount !== undefined ? main.credit_amount : main.amount;
    return sum + (creditAmount || 0);
  }, 0);

  // In double-entry bookkeeping, debits should equal credits, so we show the difference as balance
  const balance = Math.abs(debitSum - creditSum);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
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
            <SortableContext
              items={transactionsWithSubs.map(({ main }) => main.id!)}
              strategy={verticalListSortingStrategy}
            >
              {transactionsWithSubs.map(({ main, subs }, index) => (
                <SortableRow
                  key={main.id}
                  transaction={main}
                  index={index}
                  subs={subs}
                  documentCurrency={documentCurrency}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onCopy={onCopy}
                  onSplit={onSplit}
                  isAdmin={isAdmin}
                  getCurrencySymbol={getCurrencySymbol}
                  formatAmount={formatAmount}
                  getAccountDisplay={getAccountDisplay}
                />
              ))}
            </SortableContext>
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-50 font-medium">
              <TableCell colSpan={3} className="text-right font-bold">
                RAZEM:
              </TableCell>
              <TableCell className="text-right font-bold text-lg">{formatAmount(debitSum, documentCurrency)}</TableCell>
              <TableCell className="text-right font-bold text-lg">
                {formatAmount(creditSum, documentCurrency)}
              </TableCell>
              <TableCell colSpan={3} className="text-left font-bold text-lg">
                {debitSum === creditSum ? (
                  <span className="text-green-600">Bilans się zgadza ✓</span>
                ) : (
                  <span className="text-red-600">Różnica: {formatAmount(balance, documentCurrency)}</span>
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </DndContext>
  );
};

export default DocumentTable;
