
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccountCombobox } from './AccountCombobox';
import { Transaction } from './types';

interface TransactionFormProps {
  onAdd: (transaction: Transaction) => void;
  onCancel: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onAdd, onCancel }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    description: '',
    debit_account_id: '',
    credit_account_id: '',
    debit_amount: 0,
    credit_amount: 0,
    settlement_type: 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('amount') ? parseFloat(value) || 0 : value
    }));
  };

  const handleAccountChange = (accountId: string, type: 'debit' | 'credit') => {
    setFormData(prev => ({
      ...prev,
      [`${type}_account_id`]: accountId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim()) {
      toast({
        title: "Błąd",
        description: "Opis transakcji jest wymagany",
        variant: "destructive",
      });
      return;
    }

    if (!formData.debit_account_id || !formData.credit_account_id) {
      toast({
        title: "Błąd",
        description: "Wybierz konta dla obu stron transakcji",
        variant: "destructive",
      });
      return;
    }

    if (formData.debit_amount <= 0 && formData.credit_amount <= 0) {
      toast({
        title: "Błąd",
        description: "Podaj kwotę dla co najmniej jednej strony transakcji",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ensure we have a location ID
      if (!user?.location?.id) {
        throw new Error("Brak informacji o lokalizacji użytkownika");
      }

      const transaction: Transaction = {
        description: formData.description,
        debit_account_id: formData.debit_account_id,
        credit_account_id: formData.credit_account_id,
        debit_amount: formData.debit_amount,
        credit_amount: formData.credit_amount,
        amount: Math.max(formData.debit_amount, formData.credit_amount), // For backward compatibility
        settlement_type: formData.settlement_type,
        user_id: user.id,
      };

      onAdd(transaction);
      
      // Reset form
      setFormData({
        description: '',
        debit_account_id: '',
        credit_account_id: '',
        debit_amount: 0,
        credit_amount: 0,
        settlement_type: 'Bank',
      });

      toast({
        title: "Sukces",
        description: "Transakcja została dodana",
      });
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się dodać transakcji",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="description">Opis transakcji</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Opisz transakcję..."
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="settlement_type">Forma rozrachunku</Label>
          <Select
            value={formData.settlement_type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, settlement_type: value as any }))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Wybierz formę rozrachunku" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Gotówka">Gotówka</SelectItem>
              <SelectItem value="Bank">Bank</SelectItem>
              <SelectItem value="Rozrachunek">Rozrachunek</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Strona "Winien"</Label>
          <AccountCombobox
            value={formData.debit_account_id}
            onChange={(value) => handleAccountChange(value, 'debit')}
            locationId={user?.location?.id}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            name="debit_amount"
            value={formData.debit_amount}
            onChange={handleInputChange}
            placeholder="Kwota Winien"
          />
        </div>

        <div className="space-y-2">
          <Label>Strona "Ma"</Label>
          <AccountCombobox
            value={formData.credit_account_id}
            onChange={(value) => handleAccountChange(value, 'credit')}
            locationId={user?.location?.id}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            name="credit_amount"
            value={formData.credit_amount}
            onChange={handleInputChange}
            placeholder="Kwota Ma"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Anuluj
        </Button>
        <Button type="submit">
          Dodaj transakcję
        </Button>
      </div>
    </form>
  );
};

export default TransactionForm;
