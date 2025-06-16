
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useDocumentTransactions } from "./useDocumentTransactions";
import type { KpirTransaction } from "@/types/kpir";

type DocumentDialogProps = {
  open: boolean;
  onClose: () => void;
  document: {
    id: string;
    document_number: string;
    document_name: string;
    document_date: string;
  } | null;
};

const KpirDocumentDialog: React.FC<DocumentDialogProps> = ({
  open,
  onClose,
  document,
}) => {
  // Jeśli nie ma dokumentu, nie pokazuj nic
  if (!document) return null;

  // Pobranie operacji przypisanych do danego dokumentu
  const {
    data: transactions,
    isLoading,
    isError,
    error,
  } = useDocumentTransactions(document.id);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Podgląd dokumentu</DialogTitle>
          <DialogDescription>
            Numer: <b>{document.document_number}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          <div>
            <span className="font-semibold">Nazwa:</span> {document.document_name}
          </div>
          <div>
            <span className="font-semibold">Data dokumentu:</span>{" "}
            {new Date(document.document_date).toLocaleDateString("pl-PL")}
          </div>
        </div>

        <div className="mt-6">
          <div className="font-semibold mb-2">Powiązane operacje:</div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : isError ? (
            <div className="text-red-500 py-6 text-center">
              Wystąpił błąd podczas pobierania operacji:{" "}
              {(error as Error)?.message || "Nieznany błąd"}
            </div>
          ) : !transactions?.length ? (
            <div className="text-center text-omi-gray-600 py-4 italic">
              Brak operacji powiązanych z tym dokumentem.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nr operacji</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead>Konto Wn</TableHead>
                    <TableHead>Konto Ma</TableHead>
                    <TableHead>Kwota</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Waluta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: KpirTransaction) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.formattedDate}</TableCell>
                      <TableCell>{tx.document_number || "-"}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600">
                          {tx.debitAccount?.number} - {tx.debitAccount?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600">
                          {tx.creditAccount?.number} - {tx.creditAccount?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {tx.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}
                          {tx.currency !== "PLN" && ` ${tx.currency}`}
                        </span>
                      </TableCell>
                      <TableCell>{tx.settlement_type}</TableCell>
                      <TableCell>
                        {tx.currency}
                        {tx.currency !== "PLN" && tx.exchange_rate && (
                          <span className="text-xs text-omi-gray-500 block">
                            kurs: {tx.exchange_rate.toFixed(4)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KpirDocumentDialog;
