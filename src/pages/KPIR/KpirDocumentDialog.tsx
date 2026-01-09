
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Bug } from "lucide-react";
import html2canvas from "html2canvas";
import { ErrorReportDialog } from "@/components/ErrorReportDialog";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [errorReportDialogOpen, setErrorReportDialogOpen] = useState(false);
  const [errorScreenshot, setErrorScreenshot] = useState<string | null>(null);
  const [isCapturingError, setIsCapturingError] = useState(false);

  // Jeśli nie ma dokumentu, nie pokazuj nic
  if (!document) return null;

  // Pobranie operacji przypisanych do danego dokumentu
  const {
    data: transactions,
    isLoading,
    isError,
    error,
  } = useDocumentTransactions(document.id);

  const captureErrorScreenshot = async () => {
    setIsCapturingError(true);
    try {
      // Przechwytuj tylko zawartość dialogu, nie całe body
      const dialogElement = window.document.querySelector('[role="dialog"]') as HTMLElement;
      const targetElement = dialogElement || window.document.body;
      
      const canvas = await html2canvas(targetElement, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scale: 1,
        onclone: (clonedDoc) => {
          // Usuń ciemne overlay z klonu
          const overlays = clonedDoc.querySelectorAll('[data-radix-dialog-overlay]');
          overlays.forEach(el => el.remove());
        }
      });
      const dataUrl = canvas.toDataURL("image/png");
      setErrorScreenshot(dataUrl);
      setErrorReportDialogOpen(true);
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zrobić screenshota, ale możesz zgłosić błąd bez niego.",
        variant: "destructive",
      });
      setErrorScreenshot(null);
      setErrorReportDialogOpen(true);
    } finally {
      setIsCapturingError(false);
    }
  };

  const getBrowserInfo = () => {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Podgląd dokumentu</DialogTitle>
                <DialogDescription>
                  Numer: <b>{document.document_number}</b>
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureErrorScreenshot}
                disabled={isCapturingError}
                title="Zgłoś błąd"
              >
                <Bug className="h-4 w-4 mr-2" />
                {isCapturingError ? "Robię screenshot..." : "Zgłoś błąd"}
              </Button>
            </div>
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

    <ErrorReportDialog
      open={errorReportDialogOpen}
      onOpenChange={setErrorReportDialogOpen}
      autoScreenshot={errorScreenshot}
      pageUrl={window.location.href}
      browserInfo={getBrowserInfo()}
    />
  </>
  );
};

export default KpirDocumentDialog;
