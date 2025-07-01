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
  const [isFirstDebitFieldFocused, setIsFirstDebitFieldFocused] = useState(false);
  const [isFirstCreditFieldFocused, setIsFirstCreditFieldFocused] = useState(false);
  const [wasSecondFieldZeroOnFirstFocus, setWasSecondFieldZeroOnFirstFocus] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

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

  // Check if form is ready for auto-save
  const checkAutoSave = () => {
    const hasDescription = formData.description.trim().length > 0;
    const firstDebitField = debitFields[0];
    const firstCreditField = creditFields[0];
    
    const hasValidDebit = firstDebitField.amount > 0 && firstDebitField.accountId.length > 0;
    const hasValidCredit = firstCreditField.amount > 0 && firstCreditField.accountId.length > 0;
    
    if (hasDescription && hasValidDebit && hasValidCredit && !isAutoSaving) {
      console.log('Auto-save triggered - all required fields filled');
      setIsAutoSaving(true);
      handleSubmit(null, true); // true indicates auto-save
    }
  };

  // Auto-save effect - triggered when key fields change
  useEffect(() => {
    // Only check auto-save after a small delay to avoid rapid triggers
    const timer = setTimeout(() => {
      checkAutoSave();
    }, 500);

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
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>, fieldId: string, type: 'debit' | 'credit') => {
    // Jeśli wartość to "0", usuń ją całkowicie
    if (e.target.value === '0') {
      e.target.value = '';
      // Ustaw wartość w state na 0, żeby input był pusty
      if (type === 'debit') {
        setDebitFields(prev => prev.map(field => 
          field.id === fieldId ? { ...field, amount: 0 } : field
        ));
      } else {
        setCreditFields(prev => prev.map(field => 
          field.id === fieldId ? { ...field, amount: 0 } : field
        ));
      }
    }
    
    // Ustaw focus dla pierwszego pola i zapamiętaj czy drugie pole było zerem
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

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>, fieldId: string, type: 'debit' | 'credit') => {
    // Jeśli pole jest puste po utracie fokusa, ustaw na 0
    if (e.target.value === '' || e.target.value === undefined) {
      if (type === 'debit') {
        setDebitFields(prev => prev.map(field => 
          field.id === fieldId ? { ...field, amount: 0 } : field
        ));
      } else {
        setCreditFields(prev => prev.map(field => 
          field.id === fieldId ? { ...field, amount: 0 } : field
        ));
      }
    }

    // Wyłącz auto-uzupełnianie gdy pierwsze pole traci fokus
    if (fieldId === '1') {
      if (type === 'debit') {
        setIsFirstDebitFieldFocused(false);
      } else {
        setIsFirstCreditFieldFocused(false);
      }
      setWasSecondFieldZeroOnFirstFocus(false);
    }

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

    // Auto-uzupełniaj kwotę w pierwszym polu credit podczas wpisywania, ale tylko gdy:
    // 1. To jest pierwsze pole debit
    // 2. Pierwsze pole debit ma fokus  
    // 3. Drugie pole było zerem przed rozpoczęciem pisania
    if (fieldId === '1' && isFirstDebitFieldFocused && wasSecondFieldZeroOnFirstFocus) {
      setCreditFields(prev => prev.map((field, index) => 
        index === 0 ? { ...field, amount } : field
      ));
    }
  };

  const handleCreditAmountChange = (fieldId: string, amount: number) => {
    setCreditFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, amount } : field
    ));

    // Auto-uzupełniaj kwotę w pierwszym polu debit podczas wpisywania, ale tylko gdy:
    // 1. To jest pierwsze pole credit
    // 2. Pierwsze pole credit ma fokus
    // 3. Drugie pole było zerem przed rozpoczęciem pisania
    if (fieldId === '1' && isFirstCreditFieldFocused && wasSecondFieldZeroOnFirstFocus) {
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

    if (debitTotal <= 0) {
      newErrors.amounts = 'Kwoty muszą być większe od zera';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      description: '',
      settlement_type: 'Bank',
    });
    
    setDebitFields([
      { id: '1', amount: 0, accountId: '', description: '' }
    ]);
    
    setCreditFields([
      { id: '1', amount: 0, accountId: '', description: '' }
    ]);
    
    setErrors({});
    setIsAutoSaving(false);
  };

  const handleSubmit = (e: React.FormEvent | null, isAutoSave: boolean = false) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!validateForm()) {
      if (!isAutoSave) {
        toast({
          title: "Błąd",
          description: "Sprawdź poprawność danych",
          variant: "destructive",
        });
      }
      setIsAutoSaving(false);
      return;
    }

    // Get valid fields (amount > 0 and account selected)
    const validDebitFields = debitFields.filter(field => field.amount > 0 && field.accountId);
    const validCreditFields = creditFields.filter(field => field.amount > 0 && field.accountId);

    console.log('Valid debit fields:', validDebitFields);
    console.log('Valid credit fields:', validCreditFields);

    const createdTransactions: Transaction[] = [];

    // Determine the maximum number of transactions we'll create
    const maxTransactions = Math.max(validDebitFields.length, validCreditFields.length);

    // Create transactions by pairing fields one-to-one
    for (let i = 0; i < maxTransactions; i++) {
      const debitField = validDebitFields[i] || null;
      const creditField = validCreditFields[i] || null;

      // Skip if both sides are null (shouldn't happen given maxTransactions logic)
      if (!debitField && !creditField) continue;

      const transaction: Transaction = {
        description: formData.description,
        debit_account_id: debitField?.accountId || null,
        credit_account_id: creditField?.accountId || null,
        debit_amount: debitField?.amount || 0,
        credit_amount: creditField?.amount || 0,
        amount: Math.max(debitField?.amount || 0, creditField?.amount || 0),
        settlement_type: formData.settlement_type as 'Gotówka' | 'Bank' | 'Rozrachunek',
      };

      createdTransactions.push(transaction);
    }

    console.log('Created transactions:', createdTransactions);

    // Add all created transactions
    createdTransactions.forEach(transaction => {
      onAdd(transaction);
    });

    if (isAutoSave) {
      toast({
        title: "Operacja zapisana",
        description: "Automatycznie zapisano operację - gotowy na następną",
        duration: 2000,
      });
      
      // Reset form for next operation but keep it open
      resetForm();
      
      // Focus on description field for immediate next entry
      setTimeout(() => {
        const descriptionField = document.getElementById('description');
        if (descriptionField) {
          descriptionField.focus();
        }
      }, 100);
    } else {
      // Manual save - close the form
      onCancel();
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
            ✓ Automatyczny zapis aktywny
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="description">Opis operacji *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Opis operacji finansowej"
            className={errors.description ? 'border-red-500' : ''}
            disabled={isAutoSaving}
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Debit Fields */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label className="text-base font-medium">Winien (Suma: {debitTotal.toFixed(2)} zł)</Label>
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
                        value={field.amount === 0 ? '' : field.amount}
                        onChange={(e) => handleDebitAmountChange(field.id, parseFloat(e.target.value) || 0)}
                        onFocus={(e) => handleAmountFocus(e, field.id, 'debit')}
                        onBlur={(e) => handleAmountBlur(e, field.id, 'debit')}
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
                </div>
              ))}
            </div>
          </div>

          {/* Credit Fields */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label className="text-base font-medium">Ma (Suma: {creditTotal.toFixed(2)} zł)</Label>
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
                        value={field.amount === 0 ? '' : field.amount}
                        onChange={(e) => handleCreditAmountChange(field.id, parseFloat(e.target.value) || 0)}
                        onFocus={(e) => handleAmountFocus(e, field.id, 'credit')}
                        onBlur={(e) => handleAmountBlur(e, field.id, 'credit')}
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {errors.amounts && (
          <div className="text-red-500 text-sm">
            <p>{errors.amounts}</p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit" size="sm" disabled={isAutoSaving}>
            {isAutoSaving ? "Zapisywanie..." : "Dodaj operację ręcznie"}
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
