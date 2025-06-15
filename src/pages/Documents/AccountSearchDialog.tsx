
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AccountSearchPage from '@/pages/AccountSearch/AccountSearchPage';

interface AccountSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountSearchDialog = ({ isOpen, onClose }: AccountSearchDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wyszukiwanie kont</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <AccountSearchPage />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountSearchDialog;
