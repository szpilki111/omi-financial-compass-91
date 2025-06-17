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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface AmountField {
  id: string;
  amount: number;
  accountId: string;
  description?: string;
}

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

  // Check if editing is blocked for this transaction
  const { data: isEditingBlocked, isLoading: checkingBlock } = useQuery({
    queryKey: ['editingBlocked', transaction?.id, userProfile?.location_id],
    queryFn: async () => {
      if (!transaction || !userProfile?.location_id) return false;
      
      // Use the document date if available, otherwise use transaction date
      const documentDate = transaction.document?.document_date || transaction.date;
      
      const { data, error } = await supabase.rpc('check_report_editing_blocked', {
        p_location_id: userProfile.location_id,
        p_document_date: documentDate
      });

      if (error) throw error;
      return data;
    },
    enabled: !!transaction && !!userProfile?.location_id && isOpen,
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

  // Obsługa zamknięcia dialogu z ostrzeżeniem o niezapisanych zmianach
  const handleClose = () => {
    if (hasUnsavedChanges && !isEditingBlocked) {
      if (confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')) {
        handleSubmit();
        return;
      }
    }
    onClose();
  };

  const handleChange = (field: string, value: any) => {
    if (isEditingBlocked) return; // Prevent changes when editing is blocked
    
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    
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
    if (isEditingBlocked) return;
    setHasUnsavedChanges(true);
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
    if (isEditingBlocked) return;
    setHasUnsavedChanges(true);
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
    if (isEditingBlocked) return;
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
    if (isEditingBlocked) return;
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
    if (isEditingBlocked) return;
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

    if (debitTotal !== creditTotal) {
      newErrors.amounts = 'Suma kwot Winien i Ma musi być równa';
    }

    if (debitTotal <= 0) {
      newErrors.amounts = 'Kwoty muszą być większe od zera';
    }

    // Check if all accounts are selected
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
    if (isEditingBlocked) return;
    
    if (!validateForm()) {
      return;
    }

    // Create transaction for the first debit/credit pair
    const mainDebit = debitFields[0];
    const mainCredit = creditFields[0];

    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description,
      debit_account_id: mainDebit.accountId,
      credit_account_id: mainCredit.accountId,
      debit_amount: mainDebit.amount,
      credit_amount: mainCredit.amount,
      amount: Math.max(mainDebit.amount, mainCredit.amount),
    };

    onSave(updatedTransaction);
    setHasUnsavedChanges(false);
  };

  if (checkingBlock) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sprawdzanie uprawnień...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Sprawdzanie czy operacja może być edytowana...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj operację</DialogTitle>
        </DialogHeader>

        {isEditingBlocked && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nie można edytować tej operacji, ponieważ raport za ten okres został już złożony lub zatwierdzony.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Opis operacji *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Opis operacji finansowej"
              className={errors.description ? 'border-red-500' : ''}
              disabled={isEditingBlocked}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Debit Fields */}
            {!hiddenFields.debit && (
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
                            disabled={isEditingBlocked}
                          />
                        </div>
                        {debitFields.length > 1 && !isEditingBlocked && (
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
                          disabled={isEditingBlocked}
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
                            disabled={isEditingBlocked}
                          />
                        </div>
                        {creditFields.length > 1 && !isEditingBlocked && (
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
                          disabled={isEditingBlocked}
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
          <Button onClick={handleSubmit} disabled={isEditingBlocked}>
            Zapisz operację
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionEditDialog;
