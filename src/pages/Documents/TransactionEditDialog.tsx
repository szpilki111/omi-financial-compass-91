
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
import { Transaction } from './types';
import { AccountCombobox } from './AccountCombobox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface TransactionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactions: Transaction[]) => void;
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
    debit_amount: 0,
    credit_amount: 0,
    debit_account_id: '',
    credit_account_id: '',
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
        debit_amount: transaction.debit_amount || 0,
        credit_amount: transaction.credit_amount || 0,
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
      });
      setHasUnsavedChanges(false);
    }
  }, [transaction]);

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
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.description.trim()) {
      newErrors.description = 'Opis jest wymagany';
    }

    if (formData.debit_amount <= 0 && formData.credit_amount <= 0) {
      newErrors.amounts = 'Co najmniej jedna kwota musi być większa od zera';
    }
    
    if (formData.debit_amount > 0 && !formData.debit_account_id) {
      newErrors.debit_account = 'Konto Winien jest wymagane gdy kwota > 0';
    }
    
    if (formData.credit_amount > 0 && !formData.credit_account_id) {
      newErrors.credit_account = 'Konto Ma jest wymagane gdy kwota > 0';
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
      debit_account_id: formData.debit_account_id || null,
      credit_account_id: formData.credit_account_id || null,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(formData.debit_amount, formData.credit_amount),
    };

    console.log('Saving transaction:', updatedTransaction);
    onSave([updatedTransaction]);
    setHasUnsavedChanges(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Debit Fields */}
            {!hiddenFields.debit && (
              <div>
                <div className="mb-3">
                  <Label className="text-base font-medium">Winien</Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Kwota</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.debit_amount}
                      onChange={(e) => handleChange('debit_amount', parseFloat(e.target.value) || 0)}
                      onFocus={handleAmountFocus}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Konto</Label>
                    <AccountCombobox
                      value={formData.debit_account_id}
                      onChange={(accountId) => handleChange('debit_account_id', accountId)}
                      locationId={userProfile?.location_id}
                      side="debit"
                    />
                    {errors.debit_account && (
                      <p className="text-red-500 text-sm mt-1">{errors.debit_account}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Credit Fields */}
            {!hiddenFields.credit && (
              <div>
                <div className="mb-3">
                  <Label className="text-base font-medium">Ma</Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Kwota</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.credit_amount}
                      onChange={(e) => handleChange('credit_amount', parseFloat(e.target.value) || 0)}
                      onFocus={handleAmountFocus}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Konto</Label>
                    <AccountCombobox
                      value={formData.credit_account_id}
                      onChange={(accountId) => handleChange('credit_account_id', accountId)}
                      locationId={userProfile?.location_id}
                      side="credit"
                    />
                    {errors.credit_account && (
                      <p className="text-red-500 text-sm mt-1">{errors.credit_account}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {errors.amounts && (
            <div className="text-red-500 text-sm">
              <p>{errors.amounts}</p>
            </div>
          )}
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
