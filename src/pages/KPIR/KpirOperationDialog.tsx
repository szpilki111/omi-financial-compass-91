
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KpirOperationFormData, Account } from '@/types/kpir';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Check, ChevronsUpDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
  const [accountSelectOpen, setAccountSelectOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
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

  useEffect(() => {
    // Sprawdzenie czy użytkownik ma przypisaną lokalizację
    if (user && !user.location) {
      setShowLocationWarning(true);
    } else {
      setShowLocationWarning(false);
    }
  }, [user, open]);

  // Funkcja do wyszukiwania kont na podstawie zapytania
  const searchAccounts = async (query: string) => {
    if (!query || query.length < 2) {
      setAccounts([]);
      return;
    }

    try {
      setIsSearching(true);
      console.log('Wyszukiwanie kont dla zapytania:', query);
      
      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .or(`number.ilike.%${query}%,name.ilike.%${query}%`)
        .order('number', { ascending: true })
        .limit(50);
        
      if (error) {
        console.error('Błąd podczas wyszukiwania kont:', error);
        throw error;
      }
      
      console.log('Znalezione konta:', data);
      console.log('Liczba znalezionych kont:', data?.length || 0);
      
      setAccounts(data || []);
    } catch (error) {
      console.error('Błąd podczas wyszukiwania kont:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się wyszukać kont",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Effect do obsługi wyszukiwania z debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAccounts(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Resetuj wyszukiwanie gdy dialog się zamyka
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setAccounts([]);
      // Resetuj formularz
      setFormData({
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
      setErrors({});
      setHasUnsavedChanges(false);
    }
  }, [open]);

  // Obsługa zamknięcia dialogu z ostrzeżeniem o niezapisanych zmianach
  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')) {
        // Jeśli użytkownik chce zapisać, wywołaj handleSubmit
        document.getElementById('operation-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
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

  // Nowa funkcja do obsługi pól kwot z inteligentnymi zachowaniami
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

  const handleAccountChange = (accountId: string) => {
    const selectedAccount = accounts.find(acc => acc.id === accountId);
    
    setFormData({
      ...formData,
      debit_account_id: accountId,
      credit_account_id: accountId
    });
    
    setHasUnsavedChanges(true);
    
    // Ustaw wyszukiwanie na wybraną wartość, aby wyświetlała się w polu
    if (selectedAccount) {
      setSearchQuery(`${selectedAccount.number} - ${selectedAccount.name}`);
    }
    
    // Usuń błąd dla pola konta, jeśli istnieje
    if (errors.debit_account_id) {
      setErrors({ ...errors, debit_account_id: '' });
    }
    
    setAccountSelectOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Jeśli użytkownik zmieni tekst wyszukiwania, wyczyść wybrane konto
    if (formData.debit_account_id) {
      const selectedAccount = accounts.find(acc => acc.id === formData.debit_account_id);
      if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
        setFormData({
          ...formData,
          debit_account_id: '',
          credit_account_id: ''
        });
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.date) newErrors.date = 'Data jest wymagana';
    if (!formData.description) newErrors.description = 'Opis jest wymagany';
    if (formData.amount <= 0) newErrors.amount = 'Kwota musi być większa od zera';
    if (!formData.debit_account_id) newErrors.debit_account_id = 'Rodzaj konta jest wymagany';
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
      
      const { error } = await supabase
        .from('transactions')
        .insert({
          date: formData.date,
          document_number: formData.document_number,
          description: formData.description,
          amount: formData.amount,
          debit_account_id: formData.debit_account_id,
          credit_account_id: formData.credit_account_id,
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
      
      setHasUnsavedChanges(false);
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

  const selectedAccount = accounts.find(account => account.id === formData.debit_account_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
        
        <form id="operation-form" onSubmit={handleSubmit} className="space-y-4 py-4">
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
          
          {/* Rodzaj konta z wyszukiwarką */}
          <div className="space-y-1">
            <Label htmlFor="account_type" className="text-sm font-medium">
              Rodzaj konta * 
              {searchQuery.length >= 2 && (
                <span className="text-gray-500">
                  ({isSearching ? 'Wyszukiwanie...' : `${accounts.length} znalezionych kont`})
                </span>
              )}
            </Label>
            <Popover open={accountSelectOpen} onOpenChange={setAccountSelectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={accountSelectOpen}
                  className={`w-full justify-between ${errors.debit_account_id ? 'border-red-500' : ''}`}
                >
                  {selectedAccount ? 
                    `${selectedAccount.number} - ${selectedAccount.name}` : 
                    searchQuery || "Wybierz konto..."
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-white border shadow-lg z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                <Command>
                  <CommandInput 
                    placeholder="Wpisz numer lub nazwę konta..."
                    value={searchQuery}
                    onValueChange={handleSearchChange}
                  />
                  <CommandList className="max-h-60 overflow-y-auto">
                    {searchQuery.length < 2 ? (
                      <div className="py-6 text-center text-sm text-gray-500">
                        Wpisz co najmniej 2 znaki, aby wyszukać konta...
                      </div>
                    ) : isSearching ? (
                      <div className="py-6 text-center text-sm text-gray-500">
                        Wyszukiwanie...
                      </div>
                    ) : accounts.length === 0 ? (
                      <CommandEmpty>Nie znaleziono konta.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {accounts.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={`${account.number} ${account.name}`}
                            onSelect={() => handleAccountChange(account.id)}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {account.number} - {account.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.debit_account_id && <p className="text-red-500 text-xs">{errors.debit_account_id}</p>}
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

export default KpirOperationDialog;
