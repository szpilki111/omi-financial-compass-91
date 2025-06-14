
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

const KpirDocumentDialog: React.FC<DocumentDialogProps> = ({ open, onClose, document }) => {
  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Podgląd dokumentu</DialogTitle>
          <DialogDescription>
            Numer: <b>{document.document_number}</b>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <span className="font-semibold">Nazwa:</span> {document.document_name}
          </div>
          <div>
            <span className="font-semibold">Data dokumentu:</span>{" "}
            {new Date(document.document_date).toLocaleDateString("pl-PL")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KpirDocumentDialog;
