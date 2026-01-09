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
import { Bug } from 'lucide-react';
import html2canvas from 'html2canvas';
import { ErrorReportDialog } from '@/components/ErrorReportDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KpirTransaction } from '@/types/kpir';
import { useFilteredAccounts, FilteredAccount } from '@/hooks/useFilteredAccounts';
import { useToast } from '@/hooks/use-toast';
import CurrencySelector from '@/components/CurrencySelector';
import ExchangeRateManager from '@/components/ExchangeRateManager';
import CurrencyAmountInput from '@/components/CurrencyAmountInput';

interface KpirEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  transaction: KpirTransaction | null;
}

const KpirEditDialog: React.FC<KpirEditDialogProps> = ({ open, onClose, onSave, transaction }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: accounts = [] } = useFilteredAccounts();
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errorReportDialogOpen, setErrorReportDialogOpen] = useState(false);
  const [errorScreenshot, setErrorScreenshot] = useState<string | null>(null);
  const [isCapturingError, setIsCapturingError] = useState(false);
  
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

  const captureErrorScreenshot = async () => {
    setIsCapturingError(true);
    try {
      // Przechwytuj tylko zawartość dialogu, nie całe body
      const dialogElement = window.document.querySelector('[role="dialog"]') as HTMLElement;
      const targetElement = dialogElement || window.document.body;
      
      const canvas = await html2canvas(targetElement, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scale: 1,
        onclone: (clonedDoc) => {
          // Usuń ciemne overlay z klonu
          const overlays = clonedDoc.querySelectorAll('[data-radix-dialog-overlay]');
          overlays.forEach(el => el.remove());
        }
      });
      const dataUrl = canvas.toDataURL("image/png");
      setErrorScreenshot(dataUrl);
      setErrorReportDialogOpen(true);
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zrobić screenshota, ale możesz zgłosić błąd bez niego.",
        variant: "destructive",
      });
      setErrorScreenshot(null);
      setErrorReportDialogOpen(true);
    } finally {
      setIsCapturingError(false);
    }
  };

  const getBrowserInfo = () => {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Edytuj operację finansową</DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureErrorScreenshot}
                disabled={isCapturingError}
                title="Zgłoś błąd"
              >
                <Bug className="h-4 w-4 mr-2" />
                {isCapturingError ? "Robię screenshot..." : "Zgłoś błąd"}
              </Button>
            </div>
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
            {/* Enhanced Amount field with currency support */}
            <CurrencyAmountInput
              label="Kwota *"
              value={formData.amount}
              onChange={(value) => setFormData({ ...formData, amount: value })}
              currency={formData.currency}
              exchangeRate={formData.exchange_rate}
              required
            />
            
            {/* Enhanced Currency field */}
            <CurrencySelector
              value={formData.currency}
              onChange={handleCurrencyChange}
              label="Waluta *"
              required
            />
            
            {/* Exchange Rate Manager */}
            <ExchangeRateManager
              currency={formData.currency}
              value={formData.exchange_rate}
              onChange={(rate) => setFormData({ ...formData, exchange_rate: rate })}
            />
          </div>
          
          {errors.exchange_rate && <p className="text-red-500 text-xs">{errors.exchange_rate}</p>}
          
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

    <ErrorReportDialog
      open={errorReportDialogOpen}
      onOpenChange={setErrorReportDialogOpen}
      autoScreenshot={errorScreenshot}
      pageUrl={window.location.href}
      browserInfo={getBrowserInfo()}
    />
  </>
  );
};

export default KpirEditDialog;
