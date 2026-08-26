import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AccountCombobox } from '@/pages/Documents/AccountCombobox';
import ExchangeRateManager from '@/components/ExchangeRateManager';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface EditOperationDialogProps {
  isOpen: boolean;
  transactionId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface TxRow {
  id: string;
  date: string;
  description: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  amount: number | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
  currency: string;
  exchange_rate: number | null;
  location_id: string;
  document_id: string | null;
  document?: {
    id: string;
    document_number: string;
    document_name: string;
    document_date: string;
    location_id: string;
  } | null;
}

const PROVINCIAL_FEE_DESC = 'procent na prowincję';

/**
 * Edycja JEDNEJ operacji (wiersza) bez otwierania całego dokumentu.
 * Zachowuje blokady okresów (raport wysłany/zatwierdzony) i wymusza
 * zbilansowanie kwot Wn/Ma dla wiersza podstawowego.
 */
const EditOperationDialog: React.FC<EditOperationDialogProps> = ({
  isOpen,
  transactionId,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    debit_amount: 0,
    credit_amount: 0,
    debit_account_id: '',
    credit_account_id: '',
    exchange_rate: 1,
  });
  const [error, setError] = useState<string | null>(null);

  const { data: tx, isLoading } = useQuery({
    queryKey: ['edit-operation', transactionId],
    enabled: isOpen && !!transactionId,
    queryFn: async (): Promise<TxRow> => {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `id, date, description, debit_amount, credit_amount, amount, debit_account_id,
           credit_account_id, currency, exchange_rate, location_id, document_id,
           document:documents!document_id(id, document_number, document_name, document_date, location_id)`
        )
        .eq('id', transactionId!)
        .single();
      if (error) throw error;
      return data as unknown as TxRow;
    },
  });

  // Blokada okresu — ten sam mechanizm co przy edycji dokumentu.
  const { data: locked } = useQuery({
    queryKey: ['edit-operation-lock', tx?.id],
    enabled: !!tx,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_report_editing_blocked', {
        p_location_id: tx!.document?.location_id || tx!.location_id,
        p_document_date: tx!.document?.document_date || tx!.date,
      });
      if (error) throw error;
      return !!data;
    },
  });

  const isProvincialFee = (tx?.description || '') === PROVINCIAL_FEE_DESC;

  useEffect(() => {
    if (!tx) return;
    setForm({
      description: tx.description || '',
      debit_amount: tx.debit_amount ?? tx.amount ?? 0,
      credit_amount: tx.credit_amount ?? tx.amount ?? 0,
      debit_account_id: tx.debit_account_id || '',
      credit_account_id: tx.credit_account_id || '',
      exchange_rate: tx.exchange_rate || 1,
    });
    setError(null);
  }, [tx]);

  const set = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validate = (): string | null => {
    if (!form.description.trim()) return 'Opis operacji jest wymagany.';
    if (form.debit_amount <= 0 && form.credit_amount <= 0)
      return 'Co najmniej jedna kwota musi być większa od zera.';
    if (form.debit_amount > 0 && !form.debit_account_id)
      return 'Wskaż konto Wn dla podanej kwoty.';
    if (form.credit_amount > 0 && !form.credit_account_id)
      return 'Wskaż konto Ma dla podanej kwoty.';
    if (
      form.debit_amount > 0 &&
      form.credit_amount > 0 &&
      Math.abs(form.debit_amount - form.credit_amount) >= 0.01
    )
      return 'Kwoty Wn i Ma muszą być równe (operacja niezbilansowana).';
    if ((tx?.currency || 'PLN') !== 'PLN' && (!form.exchange_rate || form.exchange_rate <= 0))
      return 'Kurs waluty musi być większy od zera.';
    return null;
  };

  const handleSave = async () => {
    if (!tx) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const { error: updError } = await supabase
        .from('transactions')
        .update({
          description: form.description,
          debit_amount: form.debit_amount,
          credit_amount: form.credit_amount,
          amount: Math.max(form.debit_amount, form.credit_amount),
          debit_account_id: form.debit_account_id || null,
          credit_account_id: form.credit_account_id || null,
          exchange_rate: form.exchange_rate,
        })
        .eq('id', tx.id);
      if (updError) throw updError;

      toast({
        title: 'Operacja zapisana',
        description: 'Zmiany w wierszu zostały zapisane.',
      });
      onSaved();
    } catch (e: any) {
      const message = e?.message || 'Nie udało się zapisać operacji.';
      setError(message);
      toast({ title: 'Błąd zapisu', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !!locked || isProvincialFee;
  const currency = tx?.currency || 'PLN';
  const locationId = tx?.document?.location_id || tx?.location_id;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edytuj operację
            {tx?.document?.document_number ? ` — ${tx.document.document_number}` : ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !tx ? (
          <div className="py-8 text-center text-muted-foreground">Wczytywanie operacji…</div>
        ) : (
          <div className="space-y-4">
            {locked && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Okres jest zamknięty (raport wysłany lub zatwierdzony) — operacji nie można
                edytować.
              </div>
            )}
            {isProvincialFee && !locked && (
              <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm">
                To wiersz „procent na prowincję” — wyliczany automatycznie. Zmiany wprowadza się
                w wierszu nadrzędnym, w oknie dokumentu.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <div className="font-mono">{tx.date}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dokument</Label>
                <div className="font-mono">{tx.document?.document_number || '—'}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Waluta</Label>
                <div className="font-mono">{currency}</div>
              </div>
            </div>

            <div>
              <Label htmlFor="op-desc">Opis operacji *</Label>
              <Textarea
                id="op-desc"
                value={form.description}
                disabled={readOnly}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            {currency !== 'PLN' && (
              <div className="p-3 border rounded-md bg-muted/40">
                <ExchangeRateManager
                  currency={currency}
                  value={form.exchange_rate}
                  onChange={(rate) => set('exchange_rate', rate)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">Winien</Label>
                <div>
                  <Label className="text-sm">Kwota</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.debit_amount}
                    disabled={readOnly}
                    onChange={(e) => set('debit_amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-sm">Konto</Label>
                  <AccountCombobox
                    value={form.debit_account_id}
                    onChange={(id) => set('debit_account_id', id)}
                    locationId={locationId}
                    side="debit"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Ma</Label>
                <div>
                  <Label className="text-sm">Kwota</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.credit_amount}
                    disabled={readOnly}
                    onChange={(e) => set('credit_amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-sm">Konto</Label>
                  <AccountCombobox
                    value={form.credit_account_id}
                    onChange={(id) => set('credit_account_id', id)}
                    locationId={locationId}
                    side="credit"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Zamknij
          </Button>
          <Button onClick={handleSave} disabled={readOnly || saving || isLoading}>
            {saving ? 'Zapisywanie…' : 'Zapisz operację'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOperationDialog;
