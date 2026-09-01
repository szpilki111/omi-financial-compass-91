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
import {
  validateDocumentTransactions,
  describeValidationError,
  DocumentValidationResult,
} from '@/utils/documentValidation';
import { Transaction } from '@/pages/Documents/types';

/** Pole kwoty z formatowaniem do 2 miejsc po przecinku (akceptuje , i .) */
const AmountField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [display, setDisplay] = useState<string>(value ? value.toFixed(2) : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplay(value ? value.toFixed(2) : '');
  }, [value, focused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="0,00"
      value={display}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value;
        setDisplay(raw);
        if (raw.trim() === '' || raw.trim() === '-') return;
        onChange(parseFloat(raw.replace(',', '.')) || 0);
      }}
      onBlur={() => {
        setFocused(false);
        const raw = display.trim().replace(',', '.');
        const parsed = raw === '' || raw === '-' ? 0 : parseFloat(raw) || 0;
        onChange(parsed);
        setDisplay(parsed ? parsed.toFixed(2) : '');
      }}
    />
  );
};

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

  // Wszystkie operacje dokumentu — do kontroli spójności całego dokumentu.
  const { data: docRows, refetch: refetchDocRows } = useQuery({
    queryKey: ['edit-operation-doc-rows', tx?.document_id],
    enabled: !!tx?.document_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          'id, description, debit_amount, credit_amount, amount, debit_account_id, credit_account_id, is_parallel, display_order',
        )
        .eq('document_id', tx!.document_id!)
        .order('is_parallel', { ascending: true })
        .order('display_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  /** Mapuje wiersze z bazy na model walidacji, podmieniając edytowany wiersz na dane z formularza. */
  const buildRows = (
    rows: any[] | undefined,
    override?: { id: string; description: string; debit_amount: number; credit_amount: number; debit_account_id: string; credit_account_id: string },
  ): { list: Transaction[]; mainCount: number } => {
    const list = (rows || []).map((r) => {
      const base = {
        id: r.id,
        description: r.description || '',
        debit_amount: r.debit_amount ?? undefined,
        credit_amount: r.credit_amount ?? undefined,
        debit_account_id: r.debit_account_id || '',
        credit_account_id: r.credit_account_id || '',
        amount: r.amount ?? 0,
      } as Transaction;
      if (override && r.id === override.id) {
        return {
          ...base,
          description: override.description,
          debit_amount: override.debit_amount,
          credit_amount: override.credit_amount,
          debit_account_id: override.debit_account_id,
          credit_account_id: override.credit_account_id,
        } as Transaction;
      }
      return base;
    });
    const mainCount = (rows || []).filter((r) => !r.is_parallel).length;
    return { list, mainCount };
  };

  // Podgląd stanu dokumentu z uwzględnieniem aktualnych (jeszcze niezapisanych) zmian.
  const docState: DocumentValidationResult | null = React.useMemo(() => {
    if (!tx || !docRows) return null;
    const { list, mainCount } = buildRows(docRows, {
      id: tx.id,
      description: form.description,
      debit_amount: form.debit_amount,
      credit_amount: form.credit_amount,
      debit_account_id: form.debit_account_id,
      credit_account_id: form.credit_account_id,
    });
    return validateDocumentTransactions(list, mainCount);
  }, [tx, docRows, form]);

  const editedRowIndex = React.useMemo(() => {
    if (!tx || !docRows) return -1;
    return docRows.findIndex((r: any) => r.id === tx.id);
  }, [tx, docRows]);

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
      Math.abs(Math.round((form.debit_amount - form.credit_amount) * 100) / 100) >= 0.005
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

      // Ponowna walidacja CAŁEGO dokumentu na świeżych danych i aktualizacja statusu.
      let summary = 'Zmiany w wierszu zostały zapisane.';
      if (tx.document_id) {
        const { data: fresh } = await refetchDocRows();
        const { list, mainCount } = buildRows(fresh as any[]);
        const result = validateDocumentTransactions(list, mainCount);
        await supabase
          .from('documents')
          .update({
            validation_errors:
              result.errors.length > 0 ? (JSON.parse(JSON.stringify(result.errors)) as any) : null,
          })
          .eq('id', tx.document_id);
        summary =
          result.errors.length === 0
            ? 'Dokument jest poprawny i zbilansowany.'
            : `Dokument nadal ma ${result.errors.length} ${
                result.errors.length === 1 ? 'problem' : 'problemów'
              } — otwórz dokument, aby je poprawić.`;
      }

      toast({
        title: 'Operacja zapisana',
        description: summary,
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
                  <AmountField
                    value={form.debit_amount}
                    disabled={readOnly}
                    onChange={(v) => set('debit_amount', v)}
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

            {docState && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Stan dokumentu</Label>
                  <span
                    className={
                      docState.errors.length === 0
                        ? 'text-xs text-green-700'
                        : 'text-xs text-destructive'
                    }
                  >
                    {docState.errors.length === 0
                      ? 'Brak uwag — dokument poprawny'
                      : `${docState.errors.length} ${docState.errors.length === 1 ? 'uwaga' : 'uwag'}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Suma Wn: </span>
                    {docState.totalDebit.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Suma Ma: </span>
                    {docState.totalCredit.toFixed(2)}
                  </div>
                  <div className={docState.isBalanced ? '' : 'text-destructive font-semibold'}>
                    <span className="text-muted-foreground">Różnica: </span>
                    {docState.difference.toFixed(2)}
                  </div>
                </div>
                {docState.errors.length > 0 && (
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {docState.errors.map((e, i) => {
                      const isThisRow =
                        e.type === 'incomplete_transaction' && e.transactionIndex === editedRowIndex;
                      return (
                        <li key={i} className={isThisRow ? 'text-destructive' : 'text-muted-foreground'}>
                          {describeValidationError(e)}
                          {isThisRow ? ' — edytowany wiersz' : ''}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {docState.errors.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Uwagi dotyczące innych operacji nie blokują zapisu — popraw je w oknie dokumentu.
                  </p>
                )}
              </div>
            )}

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
