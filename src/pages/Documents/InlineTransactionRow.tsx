
import React, { useState, useEffect } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { AccountCombobox } from './AccountCombobox';
import { Transaction } from './types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface InlineTransactionRowProps {
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
  isEditingBlocked?: boolean;
}

const InlineTransactionRow: React.FC<InlineTransactionRowProps> = ({
  onSave,
  onCancel,
  isEditingBlocked = false,
}) => {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    description: '',
    debit_account_id: '',
    credit_account_id: '',
    debit_amount: 0,
    credit_amount: 0,
    settlement_type: 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
  });

  const [debitHasFocus, setDebitHasFocus] = useState(false);
  const [creditHasFocus, setCreditHasFocus] = useState(false);
  const [debitTouched, setDebitTouched] = useState(false);
  const [creditTouched, setCreditTouched] = useState(false);

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

  // Auto-populate logic based on focus state
  const handleDebitAmountChange = (value: number) => {
    setFormData(prev => {
      const newData = { ...prev, debit_amount: value };
      
      // Auto-populate credit amount only if:
      // 1. Credit field hasn't been touched by user yet AND
      // 2. Debit field currently has focus AND
      // 3. Credit amount is currently 0
      if (!creditTouched && debitHasFocus && prev.credit_amount === 0) {
        newData.credit_amount = value;
      }
      
      return newData;
    });
  };

  const handleCreditAmountChange = (value: number) => {
    setFormData(prev => {
      const newData = { ...prev, credit_amount: value };
      
      // Auto-populate debit amount only if:
      // 1. Debit field hasn't been touched by user yet AND
      // 2. Credit field currently has focus AND
      // 3. Debit amount is currently 0
      if (!debitTouched && creditHasFocus && prev.debit_amount === 0) {
        newData.debit_amount = value;
      }
      
      return newData;
    });
  };

  const handleDebitFocus = () => {
    setDebitHasFocus(true);
  };

  const handleDebitBlur = () => {
    setDebitHasFocus(false);
    setDebitTouched(true);
    
    // Copy amount to credit field if credit hasn't been touched and is 0
    if (!creditTouched && formData.credit_amount === 0 && formData.debit_amount > 0) {
      setFormData(prev => ({ ...prev, credit_amount: prev.debit_amount }));
    }
  };

  const handleCreditFocus = () => {
    setCreditHasFocus(true);
  };

  const handleCreditBlur = () => {
    setCreditHasFocus(false);
    setCreditTouched(true);
    
    // Copy amount to debit field if debit hasn't been touched and is 0
    if (!debitTouched && formData.debit_amount === 0 && formData.credit_amount > 0) {
      setFormData(prev => ({ ...prev, debit_amount: prev.credit_amount }));
    }
  };

  const handleSave = () => {
    if (!formData.description.trim() || !formData.debit_account_id || !formData.credit_account_id) {
      return;
    }

    if (formData.debit_amount <= 0 || formData.credit_amount <= 0) {
      return;
    }

    const transaction: Transaction = {
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(formData.debit_amount, formData.credit_amount),
      settlement_type: formData.settlement_type,
    };

    onSave(transaction);
  };

  const isFormValid = formData.description.trim() && 
                     formData.debit_account_id && 
                     formData.credit_account_id && 
                     formData.debit_amount > 0 && 
                     formData.credit_amount > 0;

  return (
    <TableRow className="bg-blue-50 border-2 border-blue-200">
      <TableCell>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Opis operacji..."
          className="min-h-[60px] resize-none"
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <AccountCombobox
          value={formData.debit_account_id}
          onChange={(accountId) => setFormData(prev => ({ ...prev, debit_account_id: accountId }))}
          locationId={userProfile?.location_id}
          side="debit"
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={formData.debit_amount || ''}
          onChange={(e) => handleDebitAmountChange(parseFloat(e.target.value) || 0)}
          onFocus={handleDebitFocus}
          onBlur={handleDebitBlur}
          placeholder="0.00"
          className="text-right"
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <AccountCombobox
          value={formData.credit_account_id}
          onChange={(accountId) => setFormData(prev => ({ ...prev, credit_account_id: accountId }))}
          locationId={userProfile?.location_id}
          side="credit"
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={formData.credit_amount || ''}
          onChange={(e) => handleCreditAmountChange(parseFloat(e.target.value) || 0)}
          onFocus={handleCreditFocus}
          onBlur={handleCreditBlur}
          placeholder="0.00"
          className="text-right"
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isFormValid || isEditingBlocked}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isEditingBlocked}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default InlineTransactionRow;
