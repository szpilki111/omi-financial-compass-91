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
  };
  nextSuffix: string;
}

export const AnalyticalAccountDialog: React.FC<AnalyticalAccountDialogProps> = ({
  open,
  onClose,
  onSave,
  parentAccount,
  nextSuffix
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nazwa konta jest wymagana');
      return;
    }

    if (!user || !user.location) {
      toast.error('Brak uprawnień do tworzenia kont');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('analytical_accounts')
        .insert({
          parent_account_id: parentAccount.id,
          location_id: user.location,
          number_suffix: nextSuffix,
          name: name.trim(),
          created_by: user.id
        });

      if (error) throw error;

      toast.success('Konto analityczne zostało utworzone');
      setName('');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error creating analytical account:', error);
      toast.error('Błąd podczas tworzenia konta analitycznego');
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
          <DialogTitle>Dodaj konto analityczne</DialogTitle>
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
              {parentAccount.number}-{nextSuffix}
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