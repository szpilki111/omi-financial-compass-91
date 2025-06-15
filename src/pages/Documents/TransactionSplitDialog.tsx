
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus } from 'lucide-react';
import { AccountCombobox } from './AccountCombobox';
import { Transaction } from './types';

interface SplitEntry {
  id: string;
  description: string;
  account_id: string;
  amount: number;
}

interface TransactionSplitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactions: Transaction[]) => void;
  transaction?: Transaction;
}

const TransactionSplitDialog: React.FC<TransactionSplitDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  transaction,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [splitEntries, setSplitEntries] = useState<SplitEntry[]>([
    { id: '1', description: '', account_id: '', amount: 0 },
    { id: '2', description: '', account_id: '', amount: 0 },
  ]);

  const addSplitEntry = () => {
    const newEntry: SplitEntry = {
      id: Date.now().toString(),
      description: '',
      account_id: '',
      amount: 0,
    };
    setSplitEntries(prev => [...prev, newEntry]);
  };

  const removeSplitEntry = (id: string) => {
    if (splitEntries.length > 2) {
      setSplitEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  const updateSplitEntry = (id: string, field: keyof SplitEntry, value: string | number) => {
    setSplitEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleSave = () => {
    // Validate entries
    const validEntries = splitEntries.filter(entry => 
      entry.description.trim() && entry.account_id && entry.amount > 0
    );

    if (validEntries.length < 2) {
      toast({
        title: "Błąd",
        description: "Musisz mieć co najmniej 2 prawidłowe pozycje",
        variant: "destructive",
      });
      return;
    }

    // Ensure we have a location ID
    if (!user?.location?.id) {
      toast({
        title: "Błąd",
        description: "Brak informacji o lokalizacji użytkownika",
        variant: "destructive",
      });
      return;
    }

    // Create transactions from split entries
    const transactions: Transaction[] = validEntries.map(entry => ({
      description: entry.description,
      debit_account_id: entry.account_id,
      credit_account_id: entry.account_id, // This will be updated based on transaction type
      amount: entry.amount,
      debit_amount: entry.amount,
      credit_amount: 0,
      settlement_type: 'Bank' as const,
      user_id: user.id,
      is_split_transaction: true,
      parent_transaction_id: transaction?.id,
    }));

    onSave(transactions);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Podziel transakcję</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {splitEntries.map((entry, index) => (
            <div key={entry.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <Label className="font-medium">Pozycja {index + 1}</Label>
                {splitEntries.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSplitEntry(entry.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor={`description-${entry.id}`}>Opis</Label>
                  <Textarea
                    id={`description-${entry.id}`}
                    value={entry.description}
                    onChange={(e) => updateSplitEntry(entry.id, 'description', e.target.value)}
                    placeholder="Opis pozycji..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor={`account-${entry.id}`}>Konto</Label>
                  <AccountCombobox
                    value={entry.account_id}
                    onChange={(value) => updateSplitEntry(entry.id, 'account_id', value)}
                    locationId={user?.location?.id}
                  />
                </div>

                <div>
                  <Label htmlFor={`amount-${entry.id}`}>Kwota</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    id={`amount-${entry.id}`}
                    value={entry.amount}
                    onChange={(e) => updateSplitEntry(entry.id, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addSplitEntry}
            className="w-full flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Dodaj pozycję
          </Button>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg font-medium">
              <span>Suma:</span>
              <span>
                {splitEntries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString('pl-PL', {
                  style: 'currency',
                  currency: 'PLN'
                })}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="button" onClick={handleSave}>
            Zapisz podział
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionSplitDialog;
