
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from './types';
import { AccountCombobox } from './AccountCombobox';

interface AmountField {
  id: string;
  amount: number;
  accountId: string;
  description?: string;
}

interface TransactionFormProps {
  onAdd: (transaction: Transaction) => void;
  onCancel: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onAdd, onCancel }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    description: '',
    settlement_type: 'Bank',
  });

  const [debitFields, setDebitFields] = useState<AmountField[]>([
    { id: '1', amount: 0, accountId: '', description: '' }
  ]);

  const [creditFields, setCreditFields] = useState<AmountField[]>([
    { id: '1', amount: 0, accountId: '', description: '' }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Calculate totals
  const debitTotal = debitFields.reduce((sum, field) => sum + field.amount, 0);
  const creditTotal = creditFields.reduce((sum, field) => sum + field.amount, 0);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Usuń błąd dla danego pola
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Jeśli zmienił się opis głównej operacji, zaktualizuj opisy we wszystkich polach
    if (field === 'description') {
      setDebitFields(prev => prev.map(field => ({ ...field, description: value })));
      setCreditFields(prev => prev.map(field => ({ ...field, description: value })));
    }
  };

  // Funkcje do obsługi inteligentnych pól kwot
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
    
    // Check if we need to add more fields to balance the amounts
    if (currentTotal !== oppositeTotal && currentTotal > 0 && oppositeTotal > 0) {
      const difference = Math.abs(currentTotal - oppositeTotal);
      if (difference > 0) {
        // Add a new field with the difference amount
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
    setDebitFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, amount } : field
    ));

    // Copy to first credit field only if it's 0
    if (fieldId === '1' && creditFields[0]?.amount === 0) {
      setCreditFields(prev => prev.map((field, index) => 
        index === 0 ? { ...field, amount } : field
      ));
    }
  };

  const handleCreditAmountChange = (fieldId: string, amount: number) => {
    setCreditFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, amount } : field
    ));

    // Copy to first debit field only if it's 0
    if (fieldId === '1' && debitFields[0]?.amount === 0) {
      setDebitFields(prev => prev.map((field, index) => 
        index === 0 ? { ...field, amount } : field
      ));
    }
  };

  const handleAccountChange = (fieldId: string, type: 'debit' | 'credit', accountId: string) => {
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
  };

  const removeField = (fieldId: string, type: 'debit' | 'credit') => {
    if (type === 'debit' && debitFields.length > 1) {
      setDebitFields(prev => prev.filter(field => field.id !== fieldId));
    } else if (type === 'credit' && creditFields.length > 1) {
      setCreditFields(prev => prev.filter(field => field.id !== fieldId));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.description.trim()) {
      newErrors.description = 'Opis jest wymagany';
    }

    if (debitTotal !== creditTotal) {
      newErrors.amounts = 'Suma kwot Winien i Ma musi być równa';
    }

    if (debitTotal <= 0) {
      newErrors.amounts = 'Kwoty muszą być większe od zera';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Create transactions for all fields that have amounts > 0
    const validDebitFields = debitFields.filter(field => field.amount > 0);
    const validCreditFields = creditFields.filter(field => field.amount > 0);

    // Create multiple transactions based on all valid combinations
    validDebitFields.forEach(debitField => {
      validCreditFields.forEach(creditField => {
        const transaction: Transaction = {
          description: formData.description,
          debit_account_id: debitField.accountId,
          credit_account_id: creditField.accountId,
          debit_amount: debitField.amount,
          credit_amount: creditField.amount,
          amount: Math.max(debitField.amount, creditField.amount),
          settlement_type: formData.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek',
        };

        onAdd(transaction);
      });
    });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h4 className="font-medium mb-4">Dodaj operację</h4>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <Label className="text-base font-medium mb-3 block">Winien (Suma: {debitTotal.toFixed(2)} zł)</Label>
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
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credit Fields */}
          <div>
            <Label className="text-base font-medium mb-3 block">Ma (Suma: {creditTotal.toFixed(2)} zł)</Label>
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
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addNewField('credit')}
                className="w-full"
              >
                + Dodaj pole Ma
              </Button>
            </div>
          </div>
        </div>

        {errors.amounts && (
          <div className="text-red-500 text-sm">
            <p>{errors.amounts}</p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit" size="sm">
            Dodaj operację
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Anuluj
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
