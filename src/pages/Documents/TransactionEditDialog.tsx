
import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Transaction } from './types';
import { AccountCombobox } from './AccountCombobox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface TransactionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  transaction: Transaction | null;
  isNewDocument?: boolean;
  hiddenFields?: {
    debit?: boolean;
    credit?: boolean;
  };
}

const TransactionEditDialog: React.FC<TransactionEditDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  transaction,
  isNewDocument = false,
  hiddenFields = {}
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    description: '',
    debit_account_id: '',
    credit_account_id: '',
    debit_amount: 0,
    credit_amount: 0,
    amount: 0,
    settlement_type: 'Bank',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Get user's location from profile
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('location_id')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        description: transaction.description || '',
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        debit_amount: transaction.debit_amount || 0,
        credit_amount: transaction.credit_amount || 0,
        amount: transaction.amount || 0,
        settlement_type: transaction.settlement_type || 'Bank',
      });
      setHasUnsavedChanges(false);
    }
  }, [transaction]);

  // Synchronizacja kwot - gdy jedna zmienia się, druga też (tylko jeśli nie są ukryte)
  useEffect(() => {
    if (!hiddenFields.credit && formData.debit_amount > 0 && formData.credit_amount !== formData.debit_amount) {
      setFormData(prev => ({
        ...prev,
        credit_amount: prev.debit_amount,
        amount: prev.debit_amount
      }));
    }
  }, [formData.debit_amount, hiddenFields.credit]);

  useEffect(() => {
    if (!hiddenFields.debit && formData.credit_amount > 0 && formData.debit_amount !== formData.credit_amount) {
      setFormData(prev => ({
        ...prev,
        debit_amount: prev.credit_amount,
        amount: prev.credit_amount
      }));
    }
  }, [formData.credit_amount, hiddenFields.debit]);

  // Obsługa zamknięcia dialogu z ostrzeżeniem o niezapisanych zmianach
  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')) {
        handleSubmit();
        return;
      }
    }
    onClose();
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    
    // Usuń błąd dla danego pola
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Funkcje do obsługi inteligentnych pól kwot
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>, field: string) => {
    if (e.target.value === '') {
      e.target.value = '0';
      setFormData(prev => ({ ...prev, [field]: 0 }));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const value = e.target.value;
    const numericValue = parseFloat(value) || 0;
    
    setHasUnsavedChanges(true);
    
    // Sprawdzenie czy wartość nie jest za duża
    if (value && value.length > 10) {
      setErrors(prev => ({ ...prev, [field]: 'za dużo cyfr w polu' }));
      return;
    }
    
    setFormData(prev => ({ ...prev, [field]: numericValue }));
    
    // Usuń błąd dla pola kwoty
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.description.trim()) {
      newErrors.description = 'Opis jest wymagany';
    }
    
    if (!hiddenFields.debit && !formData.debit_account_id) {
      newErrors.debit_account_id = 'Konto Winien jest wymagane';
    }
    
    if (!hiddenFields.credit && !formData.credit_account_id) {
      newErrors.credit_account_id = 'Konto Ma jest wymagane';
    }
    
    if (formData.debit_amount <= 0 && formData.credit_amount <= 0) {
      newErrors.amount = 'Kwota musi być większa od zera';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(formData.debit_amount, formData.credit_amount),
      settlement_type: formData.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek',
    };

    onSave(updatedTransaction);
    setHasUnsavedChanges(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edytuj operację</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Opis operacji *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Opis operacji finansowej"
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!hiddenFields.debit && (
              <div>
                <Label>Konto Winien *</Label>
                <AccountCombobox
                  value={formData.debit_account_id}
                  onChange={(accountId) => handleChange('debit_account_id', accountId)}
                  locationId={userProfile?.location_id}
                  className={errors.debit_account_id ? 'border-red-500' : ''}
                />
                {errors.debit_account_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.debit_account_id}</p>
                )}
              </div>
            )}

            {!hiddenFields.credit && (
              <div>
                <Label>Konto Ma *</Label>
                <AccountCombobox
                  value={formData.credit_account_id}
                  onChange={(accountId) => handleChange('credit_account_id', accountId)}
                  locationId={userProfile?.location_id}
                  className={errors.credit_account_id ? 'border-red-500' : ''}
                />
                {errors.credit_account_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.credit_account_id}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!hiddenFields.debit && (
              <div>
                <Label htmlFor="debit_amount">Kwota Winien *</Label>
                <Input
                  id="debit_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.debit_amount}
                  onChange={(e) => handleAmountChange(e, 'debit_amount')}
                  onFocus={handleAmountFocus}
                  onBlur={(e) => handleAmountBlur(e, 'debit_amount')}
                  placeholder="0.00"
                  className={errors.amount ? 'border-red-500' : ''}
                />
              </div>
            )}

            {!hiddenFields.credit && (
              <div>
                <Label htmlFor="credit_amount">Kwota Ma *</Label>
                <Input
                  id="credit_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.credit_amount}
                  onChange={(e) => handleAmountChange(e, 'credit_amount')}
                  onFocus={handleAmountFocus}
                  onBlur={(e) => handleAmountBlur(e, 'credit_amount')}
                  placeholder="0.00"
                  className={errors.amount ? 'border-red-500' : ''}
                />
              </div>
            )}
          </div>

          {errors.amount && (
            <p className="text-red-500 text-sm">{errors.amount}</p>
          )}

          <div>
            <Label>Forma rozrachunku</Label>
            <Select 
              value={formData.settlement_type} 
              onValueChange={(value) => handleChange('settlement_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gotówka">Gotówka</SelectItem>
                <SelectItem value="Bank">Bank</SelectItem>
                <SelectItem value="Rozrachunek">Rozrachunek</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit}>
            Zapisz operację
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionEditDialog;
