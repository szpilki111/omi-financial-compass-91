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
import CurrencySelector from '@/components/CurrencySelector';
import ExchangeRateManager from '@/components/ExchangeRateManager';
import CurrencyAmountInput from '@/components/CurrencyAmountInput';
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
  documentCurrency?: string;
}

const TransactionEditDialog: React.FC<TransactionEditDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  transaction,
  isNewDocument = false,
  hiddenFields = {},
  documentCurrency = 'PLN'
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    description: '',
    debit_amount: 0,
    credit_amount: 0,
    debit_account_id: '',
    credit_account_id: '',
    currency: 'PLN',
    exchange_rate: 1,
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
        currency: transaction.currency || documentCurrency,
        exchange_rate: transaction.exchange_rate || 1,
      });
      setHasUnsavedChanges(false);
    } else {
      // For new transactions, use document currency
      setFormData(prev => ({
        ...prev,
        currency: documentCurrency,
        exchange_rate: documentCurrency === 'PLN' ? 1 : prev.exchange_rate
      }));
    }
  }, [transaction, documentCurrency]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')) {
        handleSubmit();
        return;
      }
    }
    onClose();
  };

  const handleCloseWithoutSaving = () => {
    onClose();
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCurrencyChange = (currency: string) => {
    setFormData(prev => ({
      ...prev,
      currency,
      exchange_rate: currency === 'PLN' ? 1 : prev.exchange_rate
    }));
    setHasUnsavedChanges(true);
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const checkAutoSave = (updatedFormData: typeof formData) => {
    console.log('Checking auto-save with data:', updatedFormData);
    
    // Sprawdź czy wszystkie wymagane pola są wypełnione
    const hasDescription = updatedFormData.description.trim().length > 0;
    const hasValidAmounts = updatedFormData.debit_amount > 0 || updatedFormData.credit_amount > 0;
    const hasDebitAccount = updatedFormData.debit_amount > 0 ? updatedFormData.debit_account_id !== '' : true;
    const hasCreditAccount = updatedFormData.credit_amount > 0 ? updatedFormData.credit_account_id !== '' : true;
    
    // Sprawdź czy oba konta są wybrane (jeśli oba są wymagane)
    const bothAccountsSelected = updatedFormData.debit_account_id !== '' && updatedFormData.credit_account_id !== '';
    
    console.log('Auto-save check:', {
      hasDescription,
      hasValidAmounts,
      hasDebitAccount,
      hasCreditAccount,
      bothAccountsSelected
    });
    
    if (hasDescription && hasValidAmounts && hasDebitAccount && hasCreditAccount && bothAccountsSelected) {
      console.log('Auto-save conditions met, saving...');
      // Opóźnij zapis żeby pozwolić na aktualizację stanu
      setTimeout(() => {
        handleSubmitWithData(updatedFormData);
      }, 100);
    }
  };

  // Funkcja obsługująca wybór konta z automatycznym zapisem
  const handleAccountChange = (field: string, accountId: string) => {
    const updatedFormData = { ...formData, [field]: accountId };
    setFormData(updatedFormData);
    setHasUnsavedChanges(true);
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Sprawdź czy można automatycznie zapisać
    checkAutoSave(updatedFormData);
  };

  // Funkcja do przechodzenia fokusa na następne pole konta
  const focusNextAccountField = (currentType: 'debit' | 'credit') => {
    // Jeśli obecnie jest debit, przejdź na credit i odwrotnie
    const nextType = currentType === 'debit' ? 'credit' : 'debit';
    
    // Sprawdź czy następne pole nie jest ukryte
    const isNextFieldHidden = hiddenFields[nextType];
    if (isNextFieldHidden) {
      return; // Nie ma gdzie przejść
    }
    
    // Znajdź przycisk następnego pola konta
    const nextButton = document.querySelector(`[data-account-field="${nextType}"] button`);
    if (nextButton) {
      setTimeout(() => {
        (nextButton as HTMLElement).focus();
      }, 100);
    }
  };

  const validateFormWithData = (data: typeof formData): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!data.description.trim()) {
      newErrors.description = 'Opis jest wymagany';
    }

    if (data.debit_amount <= 0 && data.credit_amount <= 0) {
      newErrors.amounts = 'Co najmniej jedna kwota musi być większa od zera';
    }
    
    if (data.debit_amount > 0 && !data.debit_account_id) {
      newErrors.debit_account = 'Konto Winien jest wymagane gdy kwota > 0';
    }
    
    if (data.credit_amount > 0 && !data.credit_account_id) {
      newErrors.credit_account = 'Konto Ma jest wymagane gdy kwota > 0';
    }

    if (data.currency !== 'PLN' && (!data.exchange_rate || data.exchange_rate <= 0)) {
      newErrors.exchange_rate = 'Kurs wymiany musi być większy od zera dla walut obcych';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = (): boolean => {
    return validateFormWithData(formData);
  };

  const handleSubmitWithData = (data: typeof formData) => {
    console.log('Submitting with data:', data);
    
    if (!validateFormWithData(data)) {
      console.log('Validation failed');
      return;
    }

    const updatedTransaction: Transaction = {
      ...transaction,
      description: data.description,
      debit_account_id: data.debit_account_id || null,
      credit_account_id: data.credit_account_id || null,
      debit_amount: data.debit_amount,
      credit_amount: data.credit_amount,
      amount: Math.max(data.debit_amount, data.credit_amount),
      currency: data.currency,
      exchange_rate: data.exchange_rate,
    };

    console.log('Saving transaction:', updatedTransaction);
    onSave([updatedTransaction]);
    setHasUnsavedChanges(false);
  };

  const handleSubmit = () => {
    handleSubmitWithData(formData);
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              placeholder="Opis operacji finansowej"
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Currency and Exchange Rate Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
            <CurrencySelector
              value={formData.currency}
              onChange={handleCurrencyChange}
              required
              disabled={true}
            />
            <ExchangeRateManager
              currency={formData.currency}
              value={formData.exchange_rate}
              onChange={(rate) => handleChange('exchange_rate', rate)}
            />
            {errors.exchange_rate && (
              <p className="text-red-500 text-sm col-span-2">{errors.exchange_rate}</p>
            )}
            <p className="text-sm text-gray-500 col-span-2">
              Waluta jest dziedziczona z dokumentu
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Debit Fields */}
            {!hiddenFields.debit && (
              <div>
                <div className="mb-3">
                  <Label className="text-base font-medium">Winien</Label>
                </div>
                <div className="space-y-3">
                  <CurrencyAmountInput
                    label="Kwota"
                    value={formData.debit_amount}
                    onChange={(value) => handleChange('debit_amount', value)}
                    currency={formData.currency}
                    exchangeRate={formData.exchange_rate}
                    onFocus={handleAmountFocus}
                  />
                  <div data-account-field="debit">
                    <Label className="text-sm">Konto</Label>
                    <AccountCombobox
                      value={formData.debit_account_id}
                      onChange={(accountId) => handleChange('debit_account_id', accountId)}
                      locationId={userProfile?.location_id}
                      side="debit"
                      autoOpenOnFocus={true}
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
                  <CurrencyAmountInput
                    label="Kwota"
                    value={formData.credit_amount}
                    onChange={(value) => handleChange('credit_amount', value)}
                    currency={formData.currency}
                    exchangeRate={formData.exchange_rate}
                    onFocus={handleAmountFocus}
                  />
                  <div data-account-field="credit">
                    <Label className="text-sm">Konto</Label>
                    <AccountCombobox
                      value={formData.credit_account_id}
                      onChange={(accountId) => handleChange('credit_account_id', accountId)}
                      locationId={userProfile?.location_id}
                      side="credit"
                      autoOpenOnFocus={true}
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
          <Button variant="outline" onClick={handleCloseWithoutSaving}>
            Anuluj
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Zamknij bez zapisywania
          </Button>
          <Button onClick={handleSubmit}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionEditDialog;
