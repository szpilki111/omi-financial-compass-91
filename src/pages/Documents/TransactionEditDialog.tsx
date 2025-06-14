import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Transaction } from './DocumentDialog';
import { useToast } from '@/hooks/use-toast';
import { Account } from '@/types/kpir';

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Transaction>({
    debit_account_id: '',
    credit_account_id: '',
    amount: 0,
    description: '',
    settlement_type: 'Bank',
    debit_amount: 0,
    credit_amount: 0,
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('id, number, name, type')
          .order('number', { ascending: true });

        if (error) {
          throw error;
        }

        setAccounts(data);
      } catch (error) {
        console.error('Błąd podczas pobierania kont:', error);
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać listy kont",
          variant: "destructive",
        });
      }
    };

    fetchAccounts();
  }, [user]);

  useEffect(() => {
    if (transaction) {
      // Initialize form with transaction data
      setForm({
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        amount: transaction.amount || 0,
        description: transaction.description || '',
        settlement_type: transaction.settlement_type || 'Bank',
        debit_amount: transaction.debit_amount !== undefined ? transaction.debit_amount : transaction.amount,
        credit_amount: transaction.credit_amount !== undefined ? transaction.credit_amount : transaction.amount,
        id: transaction.id,
      });
    } else {
      // Reset form for new transactions
      setForm({
        debit_account_id: '',
        credit_account_id: '',
        amount: 0,
        description: '',
        settlement_type: 'Bank',
        debit_amount: 0,
        credit_amount: 0,
      });
    }
  }, [transaction]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate that either debit_amount or credit_amount is set
      if (!form.debit_amount && !form.credit_amount) {
        toast({
          title: "Błąd",
          description: "Musisz podać kwotę Winien lub Ma",
          variant: "destructive",
        });
        return;
      }

      // If it's a new document, we don't save to the database here
      if (isNewDocument) {
        onSave(form);
      } else {
        // If it's an existing document, update the transaction in the database
        if (!transaction?.id) {
          throw new Error("Brak ID transakcji");
        }

        const { error } = await supabase
          .from('transactions')
          .update({
            debit_account_id: form.debit_account_id,
            credit_account_id: form.credit_account_id,
            amount: form.amount,
            description: form.description,
            settlement_type: form.settlement_type,
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
      }
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

  const getAccountNameById = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? `${account.number} - ${account.name}` : 'Konto nieznane';
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
          {/* Opis */}
          <div>
            <Label htmlFor="description" className="block text-xs font-medium mb-1">Opis</Label>
            <Input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Opis transakcji"
            />
          </div>
          
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
                  value={getAccountNameById(form.debit_account_id)}
                  disabled
                  className="w-full p-2 border rounded-md bg-gray-100 text-gray-400"
                />
              ) : (
                <select
                  name="debit_account_id"
                  value={form.debit_account_id}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Wybierz konto</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.number} - {acc.name}
                    </option>
                  ))}
                </select>
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
                  value={getAccountNameById(form.credit_account_id)}
                  disabled
                  className="w-full p-2 border rounded-md bg-gray-100 text-gray-400"
                />
              ) : (
                <select
                  name="credit_account_id"
                  value={form.credit_account_id}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Wybierz konto</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.number} - {acc.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Forma rozrachunku */}
          <div>
            <Label htmlFor="settlement_type" className="block text-xs font-medium mb-1">Forma rozrachunku</Label>
            <select
              name="settlement_type"
              value={form.settlement_type}
              onChange={handleChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="Gotówka">Gotówka</option>
              <option value="Bank">Bank</option>
              <option value="Rozrachunek">Rozrachunek</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit">Zapisz zmiany</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionEditDialog;
