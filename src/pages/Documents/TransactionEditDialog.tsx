
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

interface AmountField {
  id: string;
  amount: number;
  accountId: string;
  description?: string;
}

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
  });

  const [debitFields, setDebitFields] = useState<AmountField[]>([
    { id: '1', amount: 0, accountId: '', description: '' }
  ]);

  const [creditFields, setCreditFields] = useState<AmountField[]>([
    { id: '1', amount: 0, accountId: '', description: '' }
  ]);
  
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
      });

      setDebitFields([{
        id: '1',
        amount: transaction.debit_amount || 0,
        accountId: transaction.debit_account_id || '',
        description: transaction.description || ''
      }]);

      setCreditFields([{
        id: '1',
        amount: transaction.credit_amount || 0,
        accountId: transaction.credit_account_id || '',
        description: transaction.description || ''
      }]);

      setHasUnsavedChanges(false);
    }
  }, [transaction]);

  // Calculate totals
  const debitTotal = debitFields.reduce((sum, field) => sum + field.amount, 0);
  const creditTotal = creditFields.reduce((sum, field) => sum + field.amount, 0);

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

    if (field === 'description') {
      setDebitFields(prev => prev.map(field => ({ ...field, description: value })));
      setCreditFields(prev => prev.map(field => ({ ...field, description: value })));
    }
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const handleAmountBlur = (fieldId: string, type: 'debit' | 'credit', amount: number) => {
    const fields = type === 'debit' ? debitFields : creditFields;
    const setFields = type === 'debit' ? setDebitFields : setCreditFields;
    const oppositeTotal = type === 'debit' ? creditTotal : debitTotal;
    const currentTotal = fields.reduce((sum, field) => sum + field.amount, 0);
    
    if (currentTotal !== oppositeTotal && currentTotal > 0 && oppositeTotal > 0) {
      const difference = Math.abs(currentTotal - oppositeTotal);
      if (difference > 0) {
        const newField: AmountField = {
          id: Date.now().toString(),
          amount: difference,
          accountId: '',
          description: formData.description
        };
        
        if (currentTotal < oppositeTotal) {
          setFields(prev => [...prev, newField]);
        }
      }
    }
  };

  const handleDebitAmountChange = (fieldId: string, amount: number) => {
    setHasUnsavedChanges(true);
    setDebitFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, amount } : field
    ));
  };

  const handleCreditAmountChange = (fieldId: string, amount: number) => {
    setHasUnsavedChanges(true);
    setCreditFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, amount } : field
    ));
  };

  const handleAccountChange = (fieldId: string, type: 'debit' | 'credit', accountId: string) => {
    setHasUnsavedChanges(true);
    if (type === 'debit') {
      setDebitFields(prev => prev.map(field => 
        field.id === fieldId ? { ...field, accountId } : field
      ));
    } else {
      setCreditFields(prev => prev.map(field => 
        field.id === fieldId ? { ...field, accountId } : field
      ));
    }
  };

  const addNewField = (type: 'debit' | 'credit') => {
    const newField: AmountField = {
      id: Date.now().toString(),
      amount: 0,
      accountId: '',
      description: formData.description
    };

    if (type === 'debit') {
      setDebitFields(prev => [...prev, newField]);
    } else {
      setCreditFields(prev => [...prev, newField]);
    }
    setHasUnsavedChanges(true);
  };

  const removeField = (fieldId: string, type: 'debit' | 'credit') => {
    if (type === 'debit' && debitFields.length > 1) {
      setDebitFields(prev => prev.filter(field => field.id !== fieldId));
    } else if (type === 'credit' && creditFields.length > 1) {
      setCreditFields(prev => prev.filter(field => field.id !== fieldId));
    }
    setHasUnsavedChanges(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.description.trim()) {
      newErrors.description = 'Opis jest wymagany';
    }

    if (debitTotal <= 0) {
      newErrors.amounts = 'Kwoty muszą być większe od zera';
    }

    const emptyDebitAccounts = debitFields.filter(field => field.amount > 0 && !field.accountId);
    const emptyCreditAccounts = creditFields.filter(field => field.amount > 0 && !field.accountId);
    
    if (emptyDebitAccounts.length > 0) {
      newErrors.accounts = 'Wszystkie konta Winien muszą być wybrane';
    }
    
    if (emptyCreditAccounts.length > 0) {
      newErrors.accounts = 'Wszystkie konta Ma muszą być wybrane';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const transactions: Transaction[] = [];
    
    const validDebitFields = debitFields.filter(field => field.amount > 0 && field.accountId);
    const validCreditFields = creditFields.filter(field => field.amount > 0 && field.accountId);
    
    console.log('Valid debit fields:', validDebitFields);
    console.log('Valid credit fields:', validCreditFields);

    for (let i = 0; i < validDebitFields.length; i++) {
      const debitField = validDebitFields[i];
      
      for (let j = 0; j < validCreditFields.length; j++) {
        const creditField = validCreditFields[j];
        
        if (i === 0 && j === 0) {
          const newTransaction: Transaction = {
            ...transaction,
            description: formData.description,
            debit_account_id: debitField.accountId,
            credit_account_id: creditField.accountId,
            debit_amount: debitField.amount,
            credit_amount: creditField.amount,
            amount: Math.max(debitField.amount, creditField.amount),
          };
          
          transactions.push(newTransaction);
        } else if (i > 0 || j > 0) {
          const isDifferentDebitAccount = !transactions.some(t => t.debit_account_id === debitField.accountId);
          const isDifferentCreditAccount = !transactions.some(t => t.credit_account_id === creditField.accountId);
          
          if (isDifferentDebitAccount || isDifferentCreditAccount) {
            const newTransaction: Transaction = {
              ...transaction,
              description: formData.description,
              debit_account_id: debitField.accountId,
              credit_account_id: creditField.accountId,
              debit_amount: debitField.amount,
              credit_amount: creditField.amount,
              amount: Math.max(debitField.amount, creditField.amount),
            };
            
            transactions.push(newTransaction);
          }
        }
      }
    }

    if (transactions.length === 0 && validDebitFields.length > 0 && validCreditFields.length > 0) {
      const newTransaction: Transaction = {
        ...transaction,
        description: formData.description,
        debit_account_id: validDebitFields[0].accountId,
        credit_account_id: validCreditFields[0].accountId,
        debit_amount: validDebitFields[0].amount,
        credit_amount: validCreditFields[0].amount,
        amount: Math.max(validDebitFields[0].amount, validCreditFields[0].amount),
      };
      
      transactions.push(newTransaction);
    }

    console.log('Created transactions:', transactions);
    onSave(transactions);
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
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-medium">Winien (Suma: {debitTotal.toFixed(2)} zł)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addNewField('debit')}
                  >
                    + Dodaj pole
                  </Button>
                </div>
                <div className="space-y-3">
                  {debitFields.map((field, index) => (
                    <div key={field.id} className="space-y-2">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-sm">Kwota</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={field.amount}
                            onChange={(e) => handleDebitAmountChange(field.id, parseFloat(e.target.value) || 0)}
                            onFocus={handleAmountFocus}
                            onBlur={() => handleAmountBlur(field.id, 'debit', field.amount)}
                            placeholder="0.00"
                          />
                        </div>
                        {debitFields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeField(field.id, 'debit')}
                            className="text-red-600"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm">Konto</Label>
                        <AccountCombobox
                          value={field.accountId}
                          onChange={(accountId) => handleAccountChange(field.id, 'debit', accountId)}
                          locationId={userProfile?.location_id}
                          side="debit"
                        />
                      </div>
                      {index > 0 && (
                        <div>
                          <Label className="text-sm text-gray-600">Opis operacji</Label>
                          <p className="text-sm text-gray-800 bg-gray-100 p-2 rounded border">
                            {field.description || formData.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credit Fields */}
            {!hiddenFields.credit && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-medium">Ma (Suma: {creditTotal.toFixed(2)} zł)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addNewField('credit')}
                  >
                    + Dodaj pole
                  </Button>
                </div>
                <div className="space-y-3">
                  {creditFields.map((field, index) => (
                    <div key={field.id} className="space-y-2">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-sm">Kwota</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={field.amount}
                            onChange={(e) => handleCreditAmountChange(field.id, parseFloat(e.target.value) || 0)}
                            onFocus={handleAmountFocus}
                            onBlur={() => handleAmountBlur(field.id, 'credit', field.amount)}
                            placeholder="0.00"
                          />
                        </div>
                        {creditFields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeField(field.id, 'credit')}
                            className="text-red-600"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm">Konto</Label>
                        <AccountCombobox
                          value={field.accountId}
                          onChange={(accountId) => handleAccountChange(field.id, 'credit', accountId)}
                          locationId={userProfile?.location_id}
                          side="credit"
                        />
                      </div>
                      {index > 0 && (
                        <div>
                          <Label className="text-sm text-gray-600">Opis operacji</Label>
                          <p className="text-sm text-gray-800 bg-gray-100 p-2 rounded border">
                            {field.description || formData.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(errors.amounts || errors.accounts) && (
            <div className="text-red-500 text-sm">
              {errors.amounts && <p>{errors.amounts}</p>}
              {errors.accounts && <p>{errors.accounts}</p>}
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
