import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from './types';
import { AccountCombobox } from './AccountCombobox';
import CurrencyAmountInput from './CurrencyAmountInput';
import { calculateInputWidth } from '@/utils/formatCurrency';

interface AmountField {
  id: string;
  amount: number;
  accountId: string;
  description?: string;
}

interface TransactionFormProps {
  onAdd: (transaction: Transaction) => void;
  onCancel: () => void;
  onAutoSaveComplete?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onAdd, onCancel, onAutoSaveComplete }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  
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
  const [isFirstDebitFieldFocused, setIsFirstDebitFieldFocused] = useState(false);
  const [isFirstCreditFieldFocused, setIsFirstCreditFieldFocused] = useState(false);
  const [wasSecondFieldZeroOnFirstFocus, setWasSecondFieldZeroOnFirstFocus] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Auto-focus na pole opisu
  useEffect(() => {
    const timer = setTimeout(() => {
      descriptionRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Pobierz location_id
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

  // Suma Winien / Ma
  const debitTotal = debitFields.reduce((sum, f) => sum + f.amount, 0);
  const creditTotal = creditFields.reduce((sum, f) => sum + f.amount, 0);

  // Auto-save
  const checkAutoSave = () => {
    const hasDescription = formData.description.trim().length > 0;
    const firstDebit = debitFields[0];
    const firstCredit = creditFields[0];
    const hasValidDebit = firstDebit.amount > 0 && firstDebit.accountId;
    const hasValidCredit = firstCredit.amount > 0 && firstCredit.accountId;

    if (hasDescription && hasValidDebit && hasValidCredit && !isAutoSaving) {
      setIsAutoSaving(true);
      handleSubmit(null, true);
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkAutoSave, 500);
    return () => clearTimeout(timer);
  }, [
    formData.description,
    debitFields[0]?.amount,
    debitFields[0]?.accountId,
    creditFields[0]?.amount,
    creditFields[0]?.accountId,
    isAutoSaving
  ]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (field === 'description') {
      setDebitFields(prev => prev.map(f => ({ ...f, description: value })));
      setCreditFields(prev => prev.map(f => ({ ...f, description: value })));
    }
  };

  const handleAmountFocus = (fieldId: string, type: 'debit' | 'credit') => {
    if (fieldId === '1') {
      if (type === 'debit') {
        setIsFirstDebitFieldFocused(true);
        setWasSecondFieldZeroOnFirstFocus(creditFields[0]?.amount === 0);
      } else {
        setIsFirstCreditFieldFocused(true);
        setWasSecondFieldZeroOnFirstFocus(debitFields[0]?.amount === 0);
      }
    }
  };

  const handleAmountBlur = (fieldId: string, type: 'debit' | 'credit') => {
    if (fieldId === '1') {
      if (type === 'debit') setIsFirstDebitFieldFocused(false);
      else setIsFirstCreditFieldFocused(false);
      setWasSecondFieldZeroOnFirstFocus(false);
    }

    const fields = type === 'debit' ? debitFields : creditFields;
    const setFields = type === 'debit' ? setDebitFields : setCreditFields;
    const oppositeTotal = type === 'debit' ? creditTotal : debitTotal;
    const currentTotal = fields.reduce((sum, f) => sum + f.amount, 0);

    if (currentTotal !== oppositeTotal && currentTotal > 0 && oppositeTotal > 0) {
      const difference = Math.abs(currentTotal - oppositeTotal);
      if (difference > 0.01 && currentTotal < oppositeTotal) {
        const newField: AmountField = {
          id: Date.now().toString(),
          amount: difference,
          accountId: '',
          description: formData.description
        };
        setFields(prev => [...prev, newField]);
      }
    }
  };

  const handleDebitAmountChange = (fieldId: string, amount: number) => {
    const rounded = parseFloat(amount.toFixed(2));
    setDebitFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, amount: rounded } : f
    ));

    if (fieldId === '1' && isFirstDebitFieldFocused && wasSecondFieldZeroOnFirstFocus) {
      setCreditFields(prev => prev.map((f, i) => 
        i === 0 ? { ...f, amount: rounded } : f
      ));
    }
  };

  const handleCreditAmountChange = (fieldId: string, amount: number) => {
    const rounded = parseFloat(amount.toFixed(2));
    setCreditFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, amount: rounded } : f
    ));

    if (fieldId === '1' && isFirstCreditFieldFocused && wasSecondFieldZeroOnFirstFocus) {
      setDebitFields(prev => prev.map((f, i) => 
        i === 0 ? { ...f, amount: rounded } : f
      ));
    }
  };

  const handleAccountChange = (fieldId: string, type: 'debit' | 'credit', accountId: string) => {
    if (type === 'debit') {
      setDebitFields(prev => prev.map(f => 
        f.id === fieldId ? { ...f, accountId } : f
      ));
    } else {
      setCreditFields(prev => prev.map(f => 
        f.id === fieldId ? { ...f, accountId } : f
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
    if (type === 'debit') setDebitFields(prev => [...prev, newField]);
    else setCreditFields(prev => [...prev, newField]);
  };

  const removeField = (fieldId: string, type: 'debit' | 'credit') => {
    if (type === 'debit' && debitFields.length > 1) {
      setDebitFields(prev => prev.filter(f => f.id !== fieldId));
    } else if (type === 'credit' && creditFields.length > 1) {
      setCreditFields(prev => prev.filter(f => f.id !== fieldId));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) newErrors.description = 'Opis jest wymagany';
    if (debitTotal <= 0 || creditTotal <= 0) newErrors.amounts = 'Kwoty muszą być większe od zera';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({ description: '', settlement_type: 'Bank' });
    setDebitFields([{ id: '1', amount: 0, accountId: '', description: '' }]);
    setCreditFields([{ id: '1', amount: 0, accountId: '', description: '' }]);
    setErrors({});
    setIsAutoSaving(false);
  };

  const handleSubmit = (e: React.FormEvent | null, isAutoSave: boolean = false) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      if (!isAutoSave) toast({ title: "Błąd", description: "Sprawdź poprawność danych", variant: "destructive" });
      setIsAutoSaving(false);
      return;
    }

    const validDebit = debitFields.filter(f => f.amount > 0 && f.accountId);
    const validCredit = creditFields.filter(f => f.amount > 0 && f.accountId);
    const maxTransactions = Math.max(validDebit.length, validCredit.length);

    const transactions: Transaction[] = [];
    for (let i = 0; i < maxTransactions; i++) {
      const debit = validDebit[i] || null;
      const credit = validCredit[i] || null;
      if (!debit && !credit) continue;

      transactions.push({
        description: formData.description,
        debit_account_id: debit?.accountId || null,
        credit_account_id: credit?.accountId || null,
        debit_amount: debit?.amount || 0,
        credit_amount: credit?.amount || 0,
        amount: Math.max(debit?.amount || 0, credit?.amount || 0),
        settlement_type: formData.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek',
      });
    }

    transactions.forEach(t => onAdd(t));

    if (isAutoSave) {
      toast({ title: "Zapisano", description: "Automatyczny zapis – nowe okno otwarte", duration: 2000 });
      setFormData(prev => ({ ...prev, description: '' }));
      setDebitFields(prev => prev.map(f => ({ ...f, amount: 0, description: '' })));
      setCreditFields(prev => prev.map(f => ({ ...f, amount: 0, description: '' })));
      setErrors({});
      setIsAutoSaving(false);
      onAutoSaveComplete?.();
      setTimeout(() => descriptionRef.current?.focus(), 100);
    } else {
      onCancel();
    }
  };

  const focusNextAccountField = (currentFieldId: string, currentType: 'debit' | 'credit') => {
    const currentFields = currentType === 'debit' ? debitFields : creditFields;
    const currentIndex = currentFields.findIndex(f => f.id === currentFieldId);
    if (currentIndex < currentFields.length - 1) {
      const nextId = currentFields[currentIndex + 1].id;
      const btn = document.querySelector(`[data-account-field="${currentType}-${nextId}"] button`);
      btn && (btn as HTMLElement).focus();
      return;
    }
    const oppositeType = currentType === 'debit' ? 'credit' : 'debit';
    const oppositeFields = oppositeType === 'debit' ? debitFields : creditFields;
    if (oppositeFields.length > 0) {
      const firstId = oppositeFields[0].id;
      const btn = document.querySelector(`[data-account-field="${oppositeType}-${firstId}"] button`);
      btn && (btn as HTMLElement).focus();
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium">
          {isAutoSaving ? "Zapisywanie..." : "Dodaj operację"}
        </h4>
        {isAutoSaving && (
          <div className="text-sm text-green-600 font-medium">
            Automatyczny zapis aktywny
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="description">Opis operacji *</Label>
          <Textarea
            ref={descriptionRef}
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            placeholder="Opis operacji finansowej"
            className={errors.description ? 'border-red-500' : ''}
            disabled={isAutoSaving}
          />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Winien */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label className="text-base font-medium">Winien (Suma: {debitTotal.toFixed(2)} zł)</Label>
              <Button type="button" size="sm" variant="ghost" onClick={() => addNewField('debit')}>
                + Dodaj
              </Button>
            </div>
            <div className="space-y-4">
              {debitFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-sm">Kwota</Label>
                      <CurrencyAmountInput
                        label=""
                        value={field.amount}
                        onChange={(value) => handleDebitAmountChange(field.id, value)}
                        currency="PLN"
                        exchangeRate={1}
                        baseCurrency="PLN"
                        placeholder="0.00"
                        onFocus={() => handleAmountFocus(field.id, 'debit')}
                        onBlur={() => handleAmountBlur(field.id, 'debit')}
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
                        X
                      </Button>
                    )}
                  </div>
                  <div data-account-field={`debit-${field.id}`}>
                    <Label className="text-sm">Konto</Label>
                    <AccountCombobox
                      value={field.accountId}
                      onChange={(id) => handleAccountChange(field.id, 'debit', id)}
                      locationId={userProfile?.location_id}
                      side="debit"
                      autoOpenOnFocus={true}
                      onAccountSelected={() => focusNextAccountField(field.id, 'debit')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ma */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label className="text-base font-medium">Ma (Suma: {creditTotal.toFixed(2)} zł)</Label>
              <Button type="button" size="sm" variant="ghost" onClick={() => addNewField('credit')}>
                + Dodaj
              </Button>
            </div>
            <div className="space-y-4">
              {creditFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-sm">Kwota</Label>
                      <CurrencyAmountInput
                        label=""
                        value={field.amount}
                        onChange={(value) => handleCreditAmountChange(field.id, value)}
                        currency="PLN"
                        exchangeRate={1}
                        baseCurrency="PLN"
                        placeholder="0.00"
                        onFocus={() => handleAmountFocus(field.id, 'credit')}
                        onBlur={() => handleAmountBlur(field.id, 'credit')}
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
                        X
                      </Button>
                    )}
                  </div>
                  <div data-account-field={`credit-${field.id}`}>
                    <Label className="text-sm">Konto</Label>
                    <AccountCombobox
                      value={field.accountId}
                      onChange={(id) => handleAccountChange(field.id, 'credit', id)}
                      locationId={userProfile?.location_id}
                      side="credit"
                      autoOpenOnFocus={true}
                      onAccountSelected={() => focusNextAccountField(field.id, 'credit')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {errors.amounts && <p className="text-red-500 text-sm">{errors.amounts}</p>}

        <div className="flex gap-2 pt-4">
          <Button type="submit" size="sm" disabled={isAutoSaving}>
            {isAutoSaving ? "Zapisywanie..." : "Dodaj ręcznie"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isAutoSaving}>
            {isAutoSaving ? "Czekaj..." : "Anuluj"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;