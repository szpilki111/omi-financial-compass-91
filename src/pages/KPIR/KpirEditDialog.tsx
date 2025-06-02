
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
import { KpirOperationFormData, Account, KpirTransaction } from '@/types/kpir';
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
  const [accountTypes, setAccountTypes] = useState<string[]>([]);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');
  
  const [formData, setFormData] = useState<KpirOperationFormData>({
    date: '',
    document_number: '',
    description: '',
    amount: 0,
    debit_account_id: '',
    credit_account_id: '',
    settlement_type: 'Bank',
    currency: 'PLN',
    exchange_rate: 1,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (transaction && open) {
      setFormData({
        date: transaction.date,
        document_number: transaction.document_number || '',
        description: transaction.description,
        amount: transaction.amount,
        debit_account_id: transaction.debit_account_id,
        credit_account_id: transaction.credit_account_id,
        settlement_type: transaction.settlement_type,
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate || 1,
      });

      // Ustaw wybrany typ konta na podstawie istniejącej transakcji
      if (transaction.debitAccount) {
        setSelectedAccountType(transaction.debitAccount.name);
      }
    }
  }, [transaction, open]);

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
        
        // Zbieranie unikalnych typów kont
        const types = Array.from(new Set(data.map((account: Account) => account.name)));
        setAccountTypes(types);
      } catch (error) {
        console.error('Błąd podczas pobierania kont:', error);
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać listy kont",
          variant: "destructive",
        });
      }
    };

    if (open) {
      fetchAccounts();
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'amount') {
      const numericValue = parseFloat(value) || 0;
      // Sprawdź czy wartość nie jest za duża (powyżej 999999999.99)
      if (numericValue > 999999999.99) {
        setErrors({ ...errors, [name]: 'Za duża liczba w polu kwota' });
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

  const handleAccountTypeChange = (value: string) => {
    setSelectedAccountType(value);
    // Znajdź pierwsze konto tego typu
    const accountOfType = accounts.find(account => account.name === value);
    if (accountOfType) {
      setFormData({
        ...formData,
        debit_account_id: accountOfType.id,
        credit_account_id: accountOfType.id
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.date) newErrors.date = 'Data jest wymagana';
    if (!formData.description) newErrors.description = 'Opis jest wymagany';
    if (formData.amount <= 0) newErrors.amount = 'Kwota musi być większa od zera';
    if (formData.amount > 999999999.99) newErrors.amount = 'Za duża liczba w polu kwota';
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
    
    if (!validateForm() || !transaction) {
      return;
    }
    
    setLoading(true);
    
    try {
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

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj operację finansową</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                onChange={handleChange}
                min="0"
                max="999999999.99"
                step="0.01"
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
          
          {/* Typ konta */}
          <div className="space-y-1">
            <Label htmlFor="account_type" className="text-sm font-medium">
              Rodzaj konta *
            </Label>
            <Select value={selectedAccountType} onValueChange={handleAccountTypeChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wybierz rodzaj konta" />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KpirEditDialog;
