
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface AccountNameEditDialogProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
  onAccountUpdated: (updatedAccount: Account) => void;
}

const AccountNameEditDialog = ({ account, isOpen, onClose, onAccountUpdated }: AccountNameEditDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user has permission to edit account names
  const canEditAccountNames = user?.role === 'admin' || user?.role === 'prowincjal';

  React.useEffect(() => {
    if (account && isOpen) {
      setNewName(account.name);
    }
  }, [account, isOpen]);

  const handleSave = async () => {
    if (!account || !newName.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .update({ name: newName.trim() })
        .eq('id', account.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Nazwa konta została zaktualizowana",
      });

      onAccountUpdated({ ...account, name: newName.trim() });
      onClose();
    } catch (error: any) {
      console.error('Error updating account name:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować nazwy konta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canEditAccountNames) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brak uprawnień</DialogTitle>
            <DialogDescription>
              Nie masz uprawnień do edycji nazw kont. Ta funkcja jest dostępna tylko dla administratorów i prowincjała.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj nazwę konta</DialogTitle>
          <DialogDescription>
            Zmień nazwę konta {account?.number}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="account-number">Numer konta</Label>
            <Input
              id="account-number"
              value={account?.number || ''}
              disabled
              className="bg-gray-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-name">Nazwa konta</Label>
            <Input
              id="account-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Wprowadź nową nazwę konta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={loading || !newName.trim()}>
            {loading ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountNameEditDialog;
