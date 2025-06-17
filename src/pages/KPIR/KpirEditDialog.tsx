
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KpirTransaction, Account } from '@/types/kpir';
import { useToast } from '@/hooks/use-toast';

interface KpirEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  transaction: KpirTransaction | null;
}

const KpirEditDialog: React.FC<KpirEditDialogProps> = ({ open, onClose, onSave, transaction }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [formData, setFormData] = useState({
    date: '',
    document_number: '',
    description: '',
    amount: 0,
    debit_account_id: '',
    credit_account_id: '',
    settlement_type: 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
    currency: 'PLN',
    exchange_rate: 1,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('id, number, name, type')
          .order('number', { ascending: true });
          
        if (error) {
          throw error;
        }
        
        setAccounts(data);
      } catch (error) {
        console.error('Błąd podczas pobierania kont:', error);
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać listy kont",
          variant: "destructive",
        });
      }
    };

    fetchAccounts();
  }, [user]);

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: transaction.date,
        document_number: transaction.document_number || '',
        description: transaction.description || '',
        amount: transaction.amount,
        debit_account_id: transaction.debit_account_id,
        credit_account_id: transaction.credit_account_id,
        settlement_type: transaction.settlement_type,
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate || 1,
      });
      setHasUnsavedChanges(false);
    }
  }, [transaction]);

  // Obsługa zamknięcia dialogu z ostrzeżeniem o niezapisanych zmianach
  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')) {
        // Jeśli użytkownik chce zapisać, wywołaj handleSubmit
        document.getElementById('edit-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        return;
      }
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setHasUnsavedChanges(true);
    
    if (name === 'amount') {
      const numericValue = parseFloat(value) || 0;
      
      // Sprawdzenie czy wartość nie jest za duża (maksymalnie 10 cyfr przed przecinkiem)
      if (value && value.length > 10) {
        setErrors({ ...errors, amount: 'za dużo cyfr w polu' });
        return;
      }
      
      setFormData({ ...formData, [name]: numericValue });
    } else if (name === 'exchange_rate') {
      setFormData({ ...formData, [name]: parseFloat(value) || 1 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    
    // Usuń błąd dla danego pola, jeśli istnieje
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  // Funkcje do obsługi inteligentnych pól kwot
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      e.target.value = '0';
      setFormData({ ...formData, amount: 0 });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseFloat(value) || 0;
    
    setHasUnsavedChanges(true);
    
    // Sprawdzenie czy wartość nie jest za duża
    if (value && value.length > 10) {
      setErrors({ ...errors, amount: 'za dużo cyfr w polu' });
      return;
    }
    
    setFormData({ ...formData, amount: numericValue });
    
    // Usuń błąd dla pola kwoty, jeśli istnieje
    if (errors.amount) {
      setErrors({ ...errors, amount: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.date) newErrors.date = 'Data jest wymagana';
    if (!formData.description) newErrors.description = 'Opis jest wymagany';
    if (formData.amount <= 0) newErrors.amount = 'Kwota musi być większa od zera';
    if (!formData.settlement_type) newErrors.settlement_type = 'Forma rozrachunku jest wymagana';
    if (!formData.currency) newErrors.currency = 'Waluta jest wymagana';
    if (formData.currency !== 'PLN' && (!formData.exchange_rate || formData.exchange_rate <= 0)) {
      newErrors.exchange_rate = 'Kurs wymiany musi być większy od zera';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      if (!transaction?.id) {
        throw new Error("Brak ID operacji");
      }
      
      const { error } = await supabase
        .from('transactions')
        .update({
          date: formData.date,
          document_number: formData.document_number,
          description: formData.description,
          amount: formData.amount,
          debit_account_id: formData.debit_account_id,
          credit_account_id: formData.credit_account_id,
          settlement_type: formData.settlement_type,
          currency: formData.currency,
          exchange_rate: formData.exchange_rate,
        })
        .eq('id', transaction.id);
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "Sukces",
        description: "Operacja została zaktualizowana",
      });
      
      setHasUnsavedChanges(false);
      onSave();
    } catch (error: any) {
      console.error('Błąd podczas aktualizacji operacji:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować operacji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj operację finansową</DialogTitle>
        </DialogHeader>
        
        <form id="edit-form" onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data */}
            <div className="space-y-1">
              <Label htmlFor="date" className="text-sm font-medium">
                Data operacji *
              </Label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full p-2 border rounded-md ${errors.date ? 'border-red-500' : 'border-omi-gray-300'}`}
              />
              {errors.date && <p className="text-red-500 text-xs">{errors.date}</p>}
            </div>
            
            {/* Numer dokumentu */}
            <div className="space-y-1">
              <Label htmlFor="document_number" className="text-sm font-medium">
                Numer dokumentu
              </Label>
              <input
                type="text"
                id="document_number"
                name="document_number"
                value={formData.document_number}
                onChange={handleChange}
                placeholder="FV/2023/01"
                className="w-full p-2 border border-omi-gray-300 rounded-md"
              />
            </div>
          </div>
          
          {/* Opis */}
          <div className="space-y-1">
            <Label htmlFor="description" className="text-sm font-medium">
              Opis operacji *
            </Label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="Opis operacji finansowej"
              className={`w-full p-2 border rounded-md ${errors.description ? 'border-red-500' : 'border-omi-gray-300'}`}
            />
            {errors.description && <p className="text-red-500 text-xs">{errors.description}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kwota */}
            <div className="space-y-1">
              <Label htmlFor="amount" className="text-sm font-medium">
                Kwota *
              </Label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                onFocus={handleAmountFocus}
                onBlur={handleAmountBlur}
                min="0"
                step="0.01"
                max="9999999999"
                className={`w-full p-2 border rounded-md ${errors.amount ? 'border-red-500' : 'border-omi-gray-300'}`}
              />
              {errors.amount && <p className="text-red-500 text-xs">{errors.amount}</p>}
            </div>
            
            {/* Waluta */}
            <div className="space-y-1">
              <Label htmlFor="currency" className="text-sm font-medium">
                Waluta *
              </Label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className={`w-full p-2 border rounded-md ${errors.currency ? 'border-red-500' : 'border-omi-gray-300'}`}
              >
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
              {errors.currency && <p className="text-red-500 text-xs">{errors.currency}</p>}
            </div>
            
            {/* Kurs wymiany */}
            <div className="space-y-1">
              <Label htmlFor="exchange_rate" className="text-sm font-medium">
                Kurs wymiany {formData.currency !== 'PLN' ? '*' : ''}
              </Label>
              <input
                type="number"
                id="exchange_rate"
                name="exchange_rate"
                value={formData.exchange_rate}
                onChange={handleChange}
                min="0.0001"
                step="0.0001"
                disabled={formData.currency === 'PLN'}
                className={`w-full p-2 border rounded-md ${
                  errors.exchange_rate ? 'border-red-500' : 'border-omi-gray-300'
                } ${formData.currency === 'PLN' ? 'bg-omi-gray-100' : ''}`}
              />
              {errors.exchange_rate && <p className="text-red-500 text-xs">{errors.exchange_rate}</p>}
            </div>
          </div>
          
          {/* Forma rozrachunku */}
          <div className="space-y-1">
            <Label htmlFor="settlement_type" className="text-sm font-medium">
              Forma rozrachunku *
            </Label>
            <select
              id="settlement_type"
              name="settlement_type"
              value={formData.settlement_type}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${errors.settlement_type ? 'border-red-500' : 'border-omi-gray-300'}`}
            >
              <option value="Gotówka">Gotówka</option>
              <option value="Bank">Bank</option>
              <option value="Rozrachunek">Rozrachunek</option>
            </select>
            {errors.settlement_type && <p className="text-red-500 text-xs">{errors.settlement_type}</p>}
          </div>
          
          <div className="text-xs text-omi-gray-500">
            * Pola wymagane
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Zapisz operację'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KpirEditDialog;
