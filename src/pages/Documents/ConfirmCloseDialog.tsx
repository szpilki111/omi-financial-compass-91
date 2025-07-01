
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmCloseDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onSave?: () => void;
}

const ConfirmCloseDialog: React.FC<ConfirmCloseDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  onSave
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Niezapisane zmiany</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p>Masz niezapisane zmiany w dokumencie. Czy chcesz je zapisać przed zamknięciem?</p>
        </div>

        <DialogFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
          <Button variant="outline" onClick={onConfirm}>
            Zamknij bez zapisywania
          </Button>
          {onSave && (
            <Button onClick={onSave}>
              Zapisz
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmCloseDialog;
