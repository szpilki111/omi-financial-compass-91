import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface AnalyticalAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  parentAccount: {
    id: string;
    number: string;
    name: string;
    type: string;
  };
  nextSuffix: string;
  editMode?: boolean;
  editData?: {
    id: string;
    name: string;
    number_suffix: string;
  };
}

export const AnalyticalAccountDialog: React.FC<AnalyticalAccountDialogProps> = ({
  open,
  onClose,
  onSave,
  parentAccount,
  nextSuffix,
  editMode = false,
  editData
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ustaw nazwę z editData gdy dialog się otwiera w trybie edycji
  React.useEffect(() => {
    if (editMode && editData) {
      setName(editData.name);
    } else {
      setName('');
    }
  }, [editMode, editData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nazwa konta jest wymagana');
      return;
    }

    // Sprawdź czy użytkownik ma przypisaną lokalizację
    const userLocations = user?.locations || (user?.location ? [user.location] : []);
    if (!user || userLocations.length === 0) {
      toast.error('Brak uprawnień do tworzenia kont - użytkownik nie ma przypisanej lokalizacji');
      return;
    }

    setIsLoading(true);

    try {
      if (editMode && editData) {
        // Tryb edycji - aktualizuj nazwę w obu tabelach
        
        // 1. Pobierz pełny numer konta z analytical_accounts -> accounts relationship
        const { data: analyticalData, error: fetchError } = await supabase
          .from('analytical_accounts')
          .select('parent_account_id')
          .eq('id', editData.id)
          .single();
        
        if (fetchError) throw fetchError;
        
        // 2. Pobierz numer konta rodzica
        const { data: parentAccountData, error: parentError } = await supabase
          .from('accounts')
          .select('number')
          .eq('id', analyticalData.parent_account_id)
          .single();
        
        if (parentError) throw parentError;
        
        // 3. Zbuduj pełny numer konta analitycznego
        const fullAccountNumber = `${parentAccountData.number}-${editData.number_suffix}`;
        console.log('Updating account with number:', fullAccountNumber);
        
        // 4. Zaktualizuj nazwę w tabeli accounts NAJPIERW
        const { error: accountError, data: updatedAccounts } = await supabase
          .from('accounts')
          .update({ name: name.trim() })
          .eq('number', fullAccountNumber)
          .select('id');

        if (accountError) {
          console.error('Error updating accounts table:', accountError);
          throw accountError;
        }
        
        // Sprawdź czy rekord został faktycznie zaktualizowany (RLS może cicho odrzucić)
        if (!updatedAccounts || updatedAccounts.length === 0) {
          console.error('RLS blocked update - no rows affected for account:', fullAccountNumber);
          throw new Error('Brak uprawnień do edycji tego konta. Skontaktuj się z administratorem.');
        }
        
        // 5. Zaktualizuj nazwę w tabeli analytical_accounts
        const { error: analyticalError } = await supabase
          .from('analytical_accounts')
          .update({ name: name.trim() })
          .eq('id', editData.id);

        if (analyticalError) throw analyticalError;

        toast.success('Konto analityczne zostało zaktualizowane');
      } else {
        // Tryb tworzenia - BEZPIECZNA KOLEJNOŚĆ: najpierw accounts, potem analytical_accounts
        const fullAccountNumber = `${parentAccount.number}-${nextSuffix}`;
        
        // Krok 1: Utwórz konto w tabeli accounts (z analytical: true)
        const { data: newAccount, error: accountError } = await supabase
          .from('accounts')
          .insert({
            number: fullAccountNumber,
            name: name.trim(),
            type: parentAccount.type,
            analytical: true  // Oznacz jako konto analityczne
          })
          .select('id')
          .single();

        if (accountError) {
          // Obsługa błędu 409 (duplikat)
          if (accountError.code === '23505') {
            toast.error('Konto o tym numerze już istnieje. Odśwież listę i spróbuj ponownie.');
          } else {
            throw accountError;
          }
          return;
        }

        // Krok 2: Utwórz wpis w analytical_accounts
        const locationId = user.location || userLocations[0];
        const { error: analyticalError } = await supabase
          .from('analytical_accounts')
          .insert({
            parent_account_id: parentAccount.id,
            location_id: locationId,
            number_suffix: nextSuffix,
            name: name.trim(),
            created_by: user.id
          });

        if (analyticalError) {
          // Rollback: usuń konto z accounts jeśli analytical_accounts nie powiodło się
          console.error('Analytical account creation failed, rolling back accounts entry:', analyticalError);
          await supabase.from('accounts').delete().eq('id', newAccount.id);
          
          // Obsługa błędu 409 (duplikat)
          if (analyticalError.code === '23505') {
            toast.error('Podkonto o tym numerze już istnieje. Odśwież listę i spróbuj ponownie.');
          } else {
            throw analyticalError;
          }
          return;
        }

        toast.success('Konto analityczne zostało utworzone');
      }
      
      setName('');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving analytical account:', error);
      const errorMessage = error?.message || (editMode ? 'Błąd podczas aktualizacji konta analitycznego' : 'Błąd podczas tworzenia konta analitycznego');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editMode ? 'Edytuj konto analityczne' : 'Dodaj konto analityczne'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Konto nadrzędne</Label>
            <div className="text-sm text-muted-foreground">
              {parentAccount.number} - {parentAccount.name}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Numer konta analitycznego</Label>
            <div className="text-sm text-muted-foreground">
              {parentAccount.number}-{editMode && editData ? editData.number_suffix : nextSuffix}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nazwa konta analitycznego</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wprowadź nazwę konta"
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};