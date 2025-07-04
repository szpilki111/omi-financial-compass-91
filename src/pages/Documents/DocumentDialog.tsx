import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Trash2, RefreshCw, Check, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import ConfirmCloseDialog from './ConfirmCloseDialog';
import InlineTransactionRow from './InlineTransactionRow';
import { AccountCombobox } from './AccountCombobox';
import { Transaction } from './types';
import CurrencySelector from '@/components/CurrencySelector';

interface DocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: () => void;
  document?: any;
}

interface DocumentFormData {
  document_number: string;
  document_name: string;
  document_date: Date;
  currency: string;
}

const DocumentDialog = ({
  isOpen,
  onClose,
  onDocumentCreated,
  document
}: DocumentDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransactionIndex, setEditingTransactionIndex] = useState<number | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const form = useForm<DocumentFormData>({
    defaultValues: {
      document_number: '',
      document_name: '',
      document_date: new Date(),
      currency: 'PLN'
    }
  });

  // Get user's location from profile
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('location_id').eq('id', user?.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get location settings to check if foreign currencies are allowed
  const { data: locationSettings } = useQuery({
    queryKey: ['locationSettings', userProfile?.location_id],
    queryFn: async () => {
      if (!userProfile?.location_id) return null;
      const { data, error } = await supabase
        .from('location_settings')
        .select('allow_foreign_currencies')
        .eq('location_id', userProfile.location_id)
        .single();
      if (error) return { allow_foreign_currencies: false };
      return data;
    },
    enabled: !!userProfile?.location_id
  });

  const documentDate = form.watch('document_date');
  const { data: isEditingBlocked, isLoading: checkingBlock } = useQuery({
    queryKey: ['editingBlocked', document?.id, userProfile?.location_id, documentDate],
    queryFn: async () => {
      if (!userProfile?.location_id || !documentDate) return false;
      const { data, error } = await supabase.rpc('check_report_editing_blocked', {
        p_location_id: userProfile.location_id,
        p_document_date: format(documentDate, 'yyyy-MM-dd')
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.location_id && !!documentDate && isOpen
  });

  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (transactions.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [transactions]);

  useEffect(() => {
    if (isOpen && !document) {
      setHasUnsavedChanges(false);
    }
  }, [isOpen, document]);

  useEffect(() => {
    if (isOpen && !document && transactions.length === 0 && !showInlineForm) {
      setShowInlineForm(true);
    }
  }, [isOpen, document, transactions.length, showInlineForm]);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (hasUnsavedChanges) {
        setShowConfirmClose(true);
      } else {
        onClose();
      }
    }
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmClose(false);
  };

  const handleSaveAndClose = async () => {
    const formData = form.getValues();
    await onSubmit(formData);
    setShowConfirmClose(false);
    setHasUnsavedChanges(false);
  };

  const generateDocumentNumber = async (date: Date) => {
    if (!user?.location) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji użytkownika",
        variant: "destructive"
      });
      return '';
    }
    setIsGeneratingNumber(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const { data, error } = await supabase.rpc('generate_document_number', {
        p_location_id: user.location,
        p_year: year,
        p_month: month
      });
      if (error) {
        console.error('Error generating document number:', error);
        throw error;
      }
      return data || '';
    } catch (error: any) {
      console.error('Error generating document number:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się wygenerować numeru dokumentu",
        variant: "destructive"
      });
      return '';
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  useEffect(() => {
    if (document) {
      form.reset({
        document_number: document.document_number,
        document_name: document.document_name,
        document_date: new Date(document.document_date),
        currency: document.currency || 'PLN'
      });

      loadTransactions(document.id);
      setHasUnsavedChanges(false);
    } else {
      form.reset({
        document_number: '',
        document_name: '',
        document_date: new Date(),
        currency: 'PLN'
      });
      setTransactions([]);
      setHasUnsavedChanges(false);
    }
  }, [document, form, isOpen]);

  useEffect(() => {
    if (isOpen && !document) {
      setTransactions([]);
    }
  }, [isOpen, document]);

  useEffect(() => {
    if (!document && isOpen) {
      const subscription = form.watch((value, { name }) => {
        if (name === 'document_date' && value.document_date) {
          generateDocumentNumber(new Date(value.document_date)).then(generatedNumber => {
            if (generatedNumber) {
              form.setValue('document_number', generatedNumber);
            }
          });
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [document, isOpen, form]);

  useEffect(() => {
    if (!document && isOpen && user?.location) {
      const currentDate = form.getValues('document_date');
      generateDocumentNumber(currentDate).then(generatedNumber => {
        if (generatedNumber) {
          form.setValue('document_number', generatedNumber);
        }
      });
    }
  }, [document, isOpen, user?.location]);

  const loadTransactions = async (documentId: string) => {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('document_id', documentId);
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onSubmit = async (data: DocumentFormData) => {
    if (!user?.location || !user?.id) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji lub ID użytkownika",
        variant: "destructive"
      });
      return;
    }

    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można zapisać dokumentu - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive"
      });
      return;
    }

    const allTransactions = transactions;

    if (allTransactions.length === 0) {
      toast({
        title: "Błąd walidacji",
        description: "Dokument musi zawierać co najmniej jedną operację",
        variant: "destructive"
      });
      return;
    }

    const totalDebit = allTransactions.reduce((sum, t) => {
      const debitAmount = t.debit_amount !== undefined ? t.debit_amount : 0;
      return sum + debitAmount;
    }, 0);
    const totalCredit = allTransactions.reduce((sum, t) => {
      const creditAmount = t.credit_amount !== undefined ? t.credit_amount : 0;
      return sum + creditAmount;
    }, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({
        title: "Błąd walidacji",
        description: "Suma kwot Winien i Ma musi być równa",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      let documentId = document?.id;
      if (document) {
        const { error } = await supabase.from('documents').update({
          document_number: data.document_number,
          document_name: data.document_name,
          document_date: format(data.document_date, 'yyyy-MM-dd'),
          currency: data.currency
        }).eq('id', document.id);
        if (error) throw error;
      } else {
        const { data: newDocument, error } = await supabase.from('documents').insert({
          document_number: data.document_number,
          document_name: data.document_name,
          document_date: format(data.document_date, 'yyyy-MM-dd'),
          location_id: user.location,
          user_id: user.id,
          currency: data.currency
        }).select().single();
        if (error) {
          console.error('Error creating document:', error);
          throw error;
        }
        documentId = newDocument.id;
      }

      const allTransactionsSafe = allTransactions.map((t) => ({
        ...t,
        currency: data.currency,
        description: typeof t.description === "string" && t.description.trim() !== "" ? t.description : ""
      }));

      if (documentId) {
        const { error: deleteError } = await supabase.from('transactions').delete().eq('document_id', documentId);
        if (deleteError) {
          console.error('Error deleting existing transactions:', deleteError);
          throw deleteError;
        }

        if (allTransactionsSafe.length > 0) {
          const transactionsToInsert = allTransactionsSafe.map(t => {
            return {
              document_id: documentId,
              debit_account_id: t.debit_account_id || null,
              credit_account_id: t.credit_account_id || null,
              amount: t.amount,
              debit_amount: t.debit_amount !== undefined ? t.debit_amount : 0,
              credit_amount: t.credit_amount !== undefined ? t.credit_amount : 0,
              description: t.description,
              currency: t.currency,
              date: format(data.document_date, 'yyyy-MM-dd'),
              location_id: user.location,
              user_id: user.id,
              document_number: data.document_number
            };
          });
          const { error: transactionError } = await supabase.from('transactions').insert(transactionsToInsert);
          if (transactionError) {
            console.error('Error inserting transactions:', transactionError);
            throw transactionError;
          }
        }
      }
      setHasUnsavedChanges(false);
      onDocumentCreated();
      onClose();
      toast({
        title: "Sukces",
        description: document ? "Dokument został zaktualizowany" : "Dokument został utworzony"
      });
    } catch (error: any) {
      console.error('Error saving document:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać dokumentu",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTransaction = async (transaction: Transaction) => {
    const currency = form.getValues('currency');
    const transactionWithCurrency = {
      ...transaction,
      currency
    };
    setTransactions(prev => [...prev, transactionWithCurrency]);
    setShowInlineForm(false);
    setTimeout(() => {
      setShowInlineForm(true);
    }, 100);
  };

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditTransaction = (index: number) => {
    setEditingTransactionIndex(index);
  };

  const handleSaveTransaction = async (index: number, updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map((t, i) => i === index ? updatedTransaction : t));
    setEditingTransactionIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingTransactionIndex(null);
  };

  if (checkingBlock) {
    return (
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sprawdzanie uprawnień...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Sprawdzanie czy dokument może być edytowany...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const selectedCurrency = form.watch('currency');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {document ? 'Edytuj dokument' : 'Nowy dokument'}
            </DialogTitle>
          </DialogHeader>

          {isEditingBlocked && documentDate && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nie można zapisać dokumentu na datę {format(documentDate, 'dd.MM.yyyy')}, 
                ponieważ raport za ten okres został już złożony lub zatwierdzony.
                {!document && " Możesz wybrać inną datę."}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className={cn(
                "grid gap-4",
                locationSettings?.allow_foreign_currencies 
                  ? "grid-cols-1 md:grid-cols-3" 
                  : "grid-cols-1 md:grid-cols-2"
              )}>
                <FormField
                  control={form.control}
                  name="document_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numer dokumentu</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} placeholder="np. DOM/2024/01/001" />
                        </FormControl>
                        {!document && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerateNumber}
                            disabled={isGeneratingNumber}
                            title="Wygeneruj ponownie numer dokumentu"
                          >
                            <RefreshCw className={cn("h-4 w-4", isGeneratingNumber && "animate-spin")} />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="document_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data dokumentu</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Wybierz datę"
                          disabled={date => date > new Date() || date < new Date("1900-01-01")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {locationSettings?.allow_foreign_currencies && (
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <CurrencySelector
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isEditingBlocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="document_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwa dokumentu</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opisowa nazwa dokumentu" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setHasUnsavedChanges(false);
                    onClose();
                  }}
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || (isEditingBlocked && Boolean(documentDate))}
                >
                  {isLoading ? 'Zapisywanie...' : (document ? 'Zapisz zmiany' : 'Utwórz dokument')}
                </Button>
              </div>
            </form>
          </Form>

          <div className="space-y-4 border-t pt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Operacje główne</h3>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowInlineForm(true)} className="flex items-center gap-2" disabled={isEditingBlocked}>
                  <Plus className="h-4 w-4" />
                  Dodaj operację
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opis</TableHead>
                      <TableHead>Konto Wn</TableHead>
                      <TableHead className="text-right">Winien</TableHead>
                      <TableHead>Konto Ma</TableHead>
                      <TableHead className="text-right">Ma</TableHead>
                      <TableHead>Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => (
                      <InlineTransactionRow
                        key={index}
                        transaction={transaction}
                        index={index}
                        isEditing={editingTransactionIndex === index}
                        onEdit={() => handleEditTransaction(index)}
                        onSave={updatedTransaction => handleSaveTransaction(index, updatedTransaction)}
                        onCancel={handleCancelEdit}
                        onDelete={() => removeTransaction(index)}
                      />
                    ))}
                    {showInlineForm && (
                      <InlineTransactionRow
                        onSave={addTransaction}
                        isEditingBlocked={isEditingBlocked}
                      />
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmCloseDialog
        isOpen={showConfirmClose}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        onSave={handleSaveAndClose}
      />
    </>
  );
};

interface InlineEditTransactionRowProps {
  transaction: Transaction;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const InlineEditTransactionRow: React.FC<InlineEditTransactionRowProps> = ({
  transaction,
  index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete
}) => {
  const [formData, setFormData] = useState({
    description: transaction.description || '',
    debit_account_id: transaction.debit_account_id || '',
    credit_account_id: transaction.credit_account_id || '',
    debit_amount: transaction.debit_amount || 0,
    credit_amount: transaction.credit_amount || 0,
  });

  useEffect(() => {
    setFormData({
      description: transaction.description || '',
      debit_account_id: transaction.debit_account_id || '',
      credit_account_id: transaction.credit_account_id || '',
      debit_amount: transaction.debit_amount || 0,
      credit_amount: transaction.credit_amount || 0,
    });
  }, [transaction]);

  const handleSave = () => {
    if (!formData.description.trim() || !formData.debit_account_id || !formData.credit_account_id) {
      return;
    }
    if (formData.debit_amount <= 0 || formData.credit_amount <= 0) {
      return;
    }
    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(formData.debit_amount, formData.credit_amount),
    };
    onSave(updatedTransaction);
  };

  return (
    <TableRow>
      <TableCell>
        <Textarea value={formData.description} onChange={e => setFormData(prev => ({
          ...prev,
          description: e.target.value
        }))} placeholder="Opis operacji..." className="min-h-[60px] resize-none" />
      </TableCell>
      <TableCell>
        <AccountCombobox value={formData.debit_account_id} onChange={accountId => setFormData(prev => ({
          ...prev,
          debit_account_id: accountId
        }))} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" min="0" value={formData.debit_amount || ''} onChange={e => setFormData(prev => ({
          ...prev,
          debit_amount: parseFloat(e.target.value) || 0
        }))} placeholder="0.00" className="text-right" />
      </TableCell>
      <TableCell>
        <AccountCombobox value={formData.credit_account_id} onChange={accountId => setFormData(prev => ({
          ...prev,
          credit_account_id: accountId
        }))} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" min="0" value={formData.credit_amount || ''} onChange={e => setFormData(prev => ({
          ...prev,
          credit_amount: parseFloat(e.target.value) || 0
        }))} placeholder="0.00" className="text-right" />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default DocumentDialog;
