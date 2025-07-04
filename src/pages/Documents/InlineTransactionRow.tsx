
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

  // Auto-balance amounts when one side is entered
  const handleDebitAmountChange = (value: number) => {
    setFormData(prev => ({
      ...prev,
      debit_amount: value,
      credit_amount: value > 0 && prev.credit_amount === 0 ? value : prev.credit_amount,
    }));
  };

  const handleCreditAmountChange = (value: number) => {
    setFormData(prev => ({
      ...prev,
      credit_amount: value,
      debit_amount: value > 0 && prev.debit_amount === 0 ? value : prev.debit_amount,
    }));
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
