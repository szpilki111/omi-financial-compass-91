
import React, { useState, useEffect, useRef } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AccountCombobox } from './AccountCombobox';
import { Transaction } from './types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface InlineTransactionRowProps {
  onSave: (transaction: Transaction) => void;
  isEditingBlocked?: boolean;
  currency?: string;
}

const InlineTransactionRow: React.FC<InlineTransactionRowProps> = ({
  onSave,
  isEditingBlocked = false,
  currency = 'PLN',
}) => {
  const { user } = useAuth();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  
  const [formData, setFormData] = useState({
    description: '',
    debit_account_id: '',
    credit_account_id: '',
    debit_amount: 0,
    credit_amount: 0,
    settlement_type: 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
  });

  const [creditTouched, setCreditTouched] = useState(false);
  const [debitTouched, setDebitTouched] = useState(false);

  // Auto-focus on the first field when component mounts
  useEffect(() => {
    if (descriptionRef.current && !isEditingBlocked) {
      setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100);
    }
  }, [isEditingBlocked]);

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

  // Check if all fields are filled
  const isFormValid = formData.description.trim() && 
                     formData.debit_account_id && 
                     formData.credit_account_id && 
                     formData.debit_amount > 0 && 
                     formData.credit_amount > 0;

  // Auto-accept when all fields are filled
  useEffect(() => {
    if (isFormValid && !isEditingBlocked) {
      const timer = setTimeout(() => {
        handleSave();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isFormValid, isEditingBlocked]);

  // Auto-populate logic for debit amount changes
  const handleDebitAmountChange = (value: number) => {
    setFormData(prev => {
      const newData = { ...prev, debit_amount: value };
      
      // Auto-populate credit amount if credit hasn't been manually touched and value > 0
      if (!creditTouched && value > 0) {
        newData.credit_amount = value;
      }
      
      return newData;
    });
  };

  // Auto-populate logic for credit amount changes
  const handleCreditAmountChange = (value: number) => {
    setFormData(prev => {
      const newData = { ...prev, credit_amount: value };
      
      // Auto-populate debit amount if debit hasn't been manually touched and value > 0
      if (!debitTouched && value > 0) {
        newData.debit_amount = value;
      }
      
      return newData;
    });
  };

  const handleDebitFocus = () => {
    setDebitTouched(true);
  };

  const handleCreditFocus = () => {
    setCreditTouched(true);
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
      currency: currency,
    };

    onSave(transaction);

    // Check if amounts don't match and create balancing transaction
    if (Math.abs(formData.debit_amount - formData.credit_amount) > 0.01) {
      const difference = Math.abs(formData.debit_amount - formData.credit_amount);
      
      // Create balancing transaction - only fill the side that was originally smaller
      const balancingTransaction: Transaction = {
        description: formData.description,
        debit_account_id: formData.debit_amount > formData.credit_amount ? '' : formData.credit_account_id,
        credit_account_id: formData.credit_amount > formData.debit_amount ? '' : formData.debit_account_id,
        debit_amount: formData.debit_amount > formData.credit_amount ? 0 : difference,
        credit_amount: formData.credit_amount > formData.debit_amount ? 0 : difference,
        amount: difference,
        settlement_type: formData.settlement_type,
        currency: currency,
      };

      // Save balancing transaction after a short delay
      setTimeout(() => {
        onSave(balancingTransaction);
      }, 200);
    }

    // Reset form for next transaction
    setFormData({
      description: '',
      debit_account_id: '',
      credit_account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      settlement_type: 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
    });
    setCreditTouched(false);
    setDebitTouched(false);
  };

  const getCurrencySymbol = (currency: string = 'PLN') => {
    const currencySymbols: { [key: string]: string } = {
      'PLN': 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr',
      'SEK': 'kr',
    };
    return currencySymbols[currency] || currency;
  };

  return (
    <TableRow className="bg-blue-50 border-2 border-blue-200">
      <TableCell>
        <Textarea
          ref={descriptionRef}
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
        <div className="flex items-center space-x-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.debit_amount || ''}
            onChange={(e) => handleDebitAmountChange(parseFloat(e.target.value) || 0)}
            onFocus={handleDebitFocus}
            placeholder="0.00"
            className="text-right"
            disabled={isEditingBlocked}
          />
          <span className="text-sm text-gray-500">{getCurrencySymbol(currency)}</span>
        </div>
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
        <div className="flex items-center space-x-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.credit_amount || ''}
            onChange={(e) => handleCreditAmountChange(parseFloat(e.target.value) || 0)}
            onFocus={handleCreditFocus}
            placeholder="0.00"
            className="text-right"
            disabled={isEditingBlocked}
          />
          <span className="text-sm text-gray-500">{getCurrencySymbol(currency)}</span>
        </div>
      </TableCell>
      <TableCell>
        {/* No action buttons - auto-save handles submission */}
      </TableCell>
    </TableRow>
  );
};

export default InlineTransactionRow;
