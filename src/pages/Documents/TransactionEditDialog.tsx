import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Transaction } from './types';
import { useToast } from '@/hooks/use-toast';
import { AccountCombobox } from './AccountCombobox';

interface TransactionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  transaction: Transaction | null;
  isNewDocument: boolean;
  hiddenFields: { debit?: boolean; credit?: boolean };
}

const TransactionEditDialog = ({
  isOpen,
  onClose,
  onSave,
  transaction,
  isNewDocument,
  hiddenFields,
}: any) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lockedAccountName, setLockedAccountName] = useState('');
  const [form, setForm] = useState<Transaction>({
    debit_account_id: '',
    credit_account_id: '',
    amount: 0,
    debit_amount: 0,
    credit_amount: 0,
  });

  useEffect(() => {
    if (transaction) {
      setForm({
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        amount: transaction.amount || 0,
        debit_amount: transaction.debit_amount !== undefined ? transaction.debit_amount : transaction.amount,
        credit_amount: transaction.credit_amount !== undefined ? transaction.credit_amount : transaction.amount,
        id: transaction.id,
        isCloned: transaction.isCloned,
        clonedType: transaction.clonedType,
      });

      if (transaction.isCloned) {
        const lockedAccountId =
          transaction.clonedType === 'credit'
            ? transaction.debit_account_id
            : transaction.credit_account_id;

        if (lockedAccountId) {
          const fetchLockedAccountName = async () => {
            setLockedAccountName('Ładowanie...');
            const { data } = await supabase
              .from('accounts')
              .select('number, name')
              .eq('id', lockedAccountId)
              .single();
            if (data) {
              setLockedAccountName(`${data.number} - ${data.name}`);
            } else {
              setLockedAccountName('Nieznane konto');
            }
          };
          fetchLockedAccountName();
        }
      }
    } else {
      setForm({
        debit_account_id: '',
        credit_account_id: '',
        amount: 0,
        debit_amount: 0,
        credit_amount: 0,
      });
    }
  }, [transaction]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAccountChange = (fieldName: 'debit_account_id' | 'credit_account_id', value: string) => {
    setForm(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!form.debit_amount && !form.credit_amount) {
        toast({
          title: "Błąd",
          description: "Musisz podać kwotę Winien lub Ma",
          variant: "destructive",
        });
        return;
      }

      // Uwaga: w przypadku nowego dokumentu LUB klonowanej transakcji nie zapisujemy do bazy
      if (isNewDocument || form.isCloned) {
        // Usuwamy id, żeby nie przekazywać "starego" id z bazowej transakcji
        const { id, ...newForm } = form;
        onSave(newForm as Transaction);
        onClose();
        return;
      }

      // Edycja istniejącej transakcji w bazie
      if (!transaction?.id) {
        throw new Error("Brak ID transakcji");
      }

      const { error } = await supabase
        .from('transactions')
        .update({
          debit_account_id: form.debit_account_id,
          credit_account_id: form.credit_account_id,
          amount: form.amount,
          debit_amount: form.debit_amount,
          credit_amount: form.credit_amount,
        })
        .eq('id', transaction.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Sukces",
        description: "Transakcja została zaktualizowana",
      });

      onSave(form);
      onClose();
    } catch (error: any) {
      console.error('Błąd podczas aktualizacji transakcji:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować transakcji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helpers to determine readonly/enabled for account and amount fields
  const isCloned = transaction?.isCloned;
  const clonedType = transaction?.clonedType; // 'debit' | 'credit'

  // Helper: disables non-split side in split transaction
  const isDebitLocked = isCloned && clonedType === 'credit';
  const isCreditLocked = isCloned && clonedType === 'debit';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edycja transakcji
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Usunięto pole Opis */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Winien */}
            <div>
              <label className="block text-xs font-medium mb-1 text-green-700">Kwota Winien</label>
              <input
                type="number"
                name="debit_amount"
                value={form.debit_amount || ""}
                onChange={handleChange}
                min="0"
                step="0.01"
                disabled={isDebitLocked}
                className={`w-full p-2 border rounded-md ${isDebitLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
              />
              {/* Konto Winien */}
              <label className="block text-xs font-medium mt-2 mb-1 text-green-700">Konto Winien</label>
              {isDebitLocked ? (
                <input
                  type="text"
                  value={lockedAccountName}
                  disabled
                  className="w-full p-2 border rounded-md bg-gray-100 text-gray-400"
                />
              ) : (
                <AccountCombobox
                  value={form.debit_account_id}
                  onChange={(id) => handleAccountChange('debit_account_id', id)}
                />
              )}
            </div>

            {/* Ma */}
            <div>
              <label className="block text-xs font-medium mb-1 text-blue-700">Kwota Ma</label>
              <input
                type="number"
                name="credit_amount"
                value={form.credit_amount || ""}
                onChange={handleChange}
                min="0"
                step="0.01"
                disabled={isCreditLocked}
                className={`w-full p-2 border rounded-md ${isCreditLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
              />
              {/* Konto Ma */}
              <label className="block text-xs font-medium mt-2 mb-1 text-blue-700">Konto Ma</label>
              {isCreditLocked ? (
                <input
                  type="text"
                  value={lockedAccountName}
                  disabled
                  className="w-full p-2 border rounded-md bg-gray-100 text-gray-400"
                />
              ) : (
                <AccountCombobox
                  value={form.credit_account_id}
                  onChange={(id) => handleAccountChange('credit_account_id', id)}
                />
              )}
            </div>
          </div>

          {/* Usunięto pole Forma rozrachunku */}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Zapisywanie...' : 'Zapisz zmiany'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionEditDialog;
