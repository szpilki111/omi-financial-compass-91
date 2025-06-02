
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KpirOperationFormData, Account } from '@/types/kpir';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface KpirOperationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const KpirOperationDialog: React.FC<KpirOperationDialogProps> = ({ open, onClose, onSave }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const today = new Date().toISOString().split('T')[0];
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  
  const [formData, setFormData] = useState<KpirOperationFormData>({
    date: today,
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
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');

  // Prawidłowe kategorie kont zgodnie z planem kont
  const accountCategories = [
    { value: '100', label: '100 – Kasa (środki pieniężne w kasie)' },
    { value: '200', label: '200 – Rachunki bankowe (środki na kontach bankowych)' },
    { value: '300', label: '300 – Rozrachunki z odbiorcami i dostawcami' },
    { value: '400', label: '400 – Koszty według rodzaju (np. zużycie materiałów, usługi obce)' },
    { value: '500', label: '500 – Koszty według typów działalności (np. działalność statutowa)' },
    { value: '700', label: '700 – Przychody (np. darowizny, składki)' },
    { value: '800', label: '800 – Fundusze własne (np. fundusz statutowy)' },
  ];

  useEffect(() => {
    // Sprawdzenie czy użytkownik ma przypisaną lokalizację
    if (user && !user.location) {
      setShowLocationWarning(true);
    } else {
      setShowLocationWarning(false);
    }

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
    // Filtrowanie kont na podstawie wybranego typu
    if (selectedAccountType) {
      const filtered = accounts.filter(account => account.number.startsWith(selectedAccountType));
      setFilteredAccounts(filtered);
    } else {
      setFilteredAccounts(accounts);
    }
  }, [selectedAccountType, accounts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'amount') {
      const numericValue = parseFloat(value) || 0;
      
      // Sprawdzenie czy wartość nie jest za duża (maksymalnie 15 cyfr przed przecinkiem)
      if (value && value.length > 15) {
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

  const handleAccountTypeChange = (value: string) => {
    setSelectedAccountType(value);
    // Resetowanie wybranego konta po zmianie typu
    setFormData({
      ...formData,
      debit_account_id: '',
      credit_account_id: ''
    });
  };

  const handleAccountChange = (fieldName: string, accountId: string) => {
    setFormData({
      ...formData,
      [fieldName]: accountId
    });
    
    // Usuń błąd dla danego pola, jeśli istnieje
    if (errors[fieldName]) {
      setErrors({ ...errors, [fieldName]: '' });
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
    
    // Ustawiamy domyślną lokalizację jeśli nie ma przypisanej
    // W przyszłości można dodać pole wyboru lokalizacji w formularzu
    if (!user) {
      toast({
        title: "Błąd",
        description: "Nie jesteś zalogowany",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Używamy domyślnej lokalizacji lub null jeśli nie ma przypisanej
      const locationId = user.location || null;
      
      // Przypisujemy takie samo konto do debetu i kredytu dla uproszczenia
      // W przyszłości można dodać ponownie wybór obu kont
      const selectedAccountId = selectedAccountType ? 
        filteredAccounts.length > 0 ? filteredAccounts[0].id : null : null;
      
      if (!selectedAccountId) {
        throw new Error("Nie wybrano konta");
      }
      
      const { error } = await supabase
        .from('transactions')
        .insert({
          date: formData.date,
          document_number: formData.document_number,
          description: formData.description,
          amount: formData.amount,
          debit_account_id: selectedAccountId,
          credit_account_id: selectedAccountId,
          settlement_type: formData.settlement_type,
          currency: formData.currency,
          exchange_rate: formData.exchange_rate,
          location_id: locationId,
          user_id: user.id
        });
        
      if (error) {
        throw error;
      }
      
      toast({
        title: "Sukces",
        description: "Operacja została dodana",
      });
      
      onSave();
    } catch (error: any) {
      console.error('Błąd podczas dodawania operacji:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się dodać operacji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nowa operacja finansowa</DialogTitle>
        </DialogHeader>
        
        {showLocationWarning && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Uwaga: Twoje konto nie ma przypisanej lokalizacji. Operacje będą zapisywane bez przypisania do konkretnej placówki.
            </AlertDescription>
          </Alert>
        )}
        
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
                {accountCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
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
              {loading ? 'Zapisywanie...' : 'Zapisz operację'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KpirOperationDialog;
