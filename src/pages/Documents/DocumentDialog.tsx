
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2, RefreshCw, Edit, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import TransactionForm from './TransactionForm';
import TransactionEditDialog from './TransactionEditDialog';

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
}

interface Transaction {
  id?: string;
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  description: string;
  settlement_type: string;
  debit_amount?: number;
  credit_amount?: number;
  isCloned?: boolean;
  clonedType?: 'debit' | 'credit';
}

const DocumentDialog = ({ isOpen, onClose, onDocumentCreated, document }: DocumentDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingTransactionIndex, setEditingTransactionIndex] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [hiddenFieldsInEdit, setHiddenFieldsInEdit] = useState<{debit?: boolean, credit?: boolean}>({});
  const [isClonedTransaction, setIsClonedTransaction] = useState(false);

  const form = useForm<DocumentFormData>({
    defaultValues: {
      document_number: '',
      document_name: '',
      document_date: new Date(),
    },
  });

  // Generate document number using the database function
  const generateDocumentNumber = async (date: Date) => {
    if (!user?.location) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji użytkownika",
        variant: "destructive",
      });
      return '';
    }

    setIsGeneratingNumber(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // JavaScript months are 0-indexed

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
        variant: "destructive",
      });
      return '';
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  // Load document data when editing
  useEffect(() => {
    if (document) {
      form.reset({
        document_number: document.document_number,
        document_name: document.document_name,
        document_date: new Date(document.document_date),
      });
      
      // Load existing transactions only for existing documents
      loadTransactions(document.id);
    } else {
      // For new documents, always start with empty form and no transactions
      form.reset({
        document_number: '',
        document_name: '',
        document_date: new Date(),
      });
      setTransactions([]); // Explicitly clear transactions for new documents
    }
  }, [document, form, isOpen]); // Added isOpen to dependency array

  // Clear transactions when dialog closes and opens for new document
  useEffect(() => {
    if (isOpen && !document) {
      // This is a new document - ensure transactions are cleared
      setTransactions([]);
    }
  }, [isOpen, document]);

  // Auto-generate document number for new documents when date changes
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

  // Generate initial document number for new documents
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
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('document_id', documentId);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleRegenerateNumber = async () => {
    const currentDate = form.getValues('document_date');
    const generatedNumber = await generateDocumentNumber(currentDate);
    if (generatedNumber) {
      form.setValue('document_number', generatedNumber);
      toast({
        title: "Sukces",
        description: "Numer dokumentu został wygenerowany ponownie",
      });
    }
  };

  const onSubmit = async (data: DocumentFormData) => {
    if (!user?.location || !user?.id) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji lub ID użytkownika",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let documentId = document?.id;

      console.log('Creating/updating document with user_id:', user.id);

      if (document) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            document_number: data.document_number,
            document_name: data.document_name,
            document_date: format(data.document_date, 'yyyy-MM-dd'),
          })
          .eq('id', document.id);

        if (error) throw error;
      } else {
        // Create new document - ensure user_id is set correctly
        const { data: newDocument, error } = await supabase
          .from('documents')
          .insert({
            document_number: data.document_number,
            document_name: data.document_name,
            document_date: format(data.document_date, 'yyyy-MM-dd'),
            location_id: user.location,
            user_id: user.id, // Explicitly set the user_id
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating document:', error);
          throw error;
        }
        
        console.log('Document created successfully:', newDocument);
        documentId = newDocument.id;
      }

      // Save transactions if any
      if (transactions.length > 0 && documentId) {
        // First, delete existing transactions if editing
        if (document) {
          await supabase
            .from('transactions')
            .delete()
            .eq('document_id', documentId);
        }

        // Insert new/updated transactions
        const transactionsToInsert = transactions.map(t => ({
          document_id: documentId,
          debit_account_id: t.debit_account_id,
          credit_account_id: t.credit_account_id,
          amount: t.debit_amount || t.amount, // Use debit_amount as primary amount
          debit_amount: t.debit_amount || t.amount,
          credit_amount: t.credit_amount || t.amount,
          description: t.description,
          settlement_type: t.settlement_type,
          date: format(data.document_date, 'yyyy-MM-dd'),
          location_id: user.location,
          user_id: user.id, // Ensure user_id is set for transactions too
        }));

        const { error: transactionError } = await supabase
          .from('transactions')
          .insert(transactionsToInsert);

        if (transactionError) throw transactionError;
      }

      onDocumentCreated();
      onClose();
    } catch (error: any) {
      console.error('Error saving document:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać dokumentu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [...prev, transaction]);
    setShowTransactionForm(false);
  };

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const duplicateDebitSide = (index: number) => {
    const originalTransaction = transactions[index];
    
    // Update original transaction - remove debit amount
    const updatedOriginal = {
      ...originalTransaction,
      debit_amount: 0,
      amount: originalTransaction.credit_amount || originalTransaction.amount,
    };
    
    // Create duplicated transaction with only debit side
    const duplicatedTransaction: Transaction = {
      ...originalTransaction,
      description: '', // Clear description for editing
      debit_amount: originalTransaction.debit_amount || originalTransaction.amount,
      credit_amount: 0, // Set credit side to 0
      amount: originalTransaction.debit_amount || originalTransaction.amount,
      id: undefined, // Remove ID so it gets a new one when saved
      isCloned: true,
      clonedType: 'debit' as const
    };
    
    setTransactions(prev => {
      const updated = [...prev];
      // Update the original transaction
      updated[index] = updatedOriginal;
      // Insert the duplicated transaction right after the original one
      updated.splice(index + 1, 0, duplicatedTransaction);
      return updated;
    });

    toast({
      title: "Sukces",
      description: "Strona Winien została powielona",
    });
  };

  const duplicateCreditSide = (index: number) => {
    const originalTransaction = transactions[index];
    
    // Update original transaction - remove credit amount
    const updatedOriginal = {
      ...originalTransaction,
      credit_amount: 0,
      amount: originalTransaction.debit_amount || originalTransaction.amount,
    };
    
    // Create duplicated transaction with only credit side
    const duplicatedTransaction: Transaction = {
      ...originalTransaction,
      description: '', // Clear description for editing
      debit_amount: 0, // Set debit side to 0
      credit_amount: originalTransaction.credit_amount || originalTransaction.amount,
      amount: originalTransaction.credit_amount || originalTransaction.amount,
      id: undefined, // Remove ID so it gets a new one when saved
      isCloned: true,
      clonedType: 'credit' as const
    };
    
    setTransactions(prev => {
      const updated = [...prev];
      // Update the original transaction
      updated[index] = updatedOriginal;
      // Insert the duplicated transaction right after the original one
      updated.splice(index + 1, 0, duplicatedTransaction);
      return updated;
    });

    toast({
      title: "Sukces",
      description: "Strona Ma została powielona",
    });
  };

  const handleEditTransaction = (transaction: Transaction, index: number) => {
    // Check if this is a cloned transaction and determine hidden fields
    let hideFields = {};
    
    if (transaction.isCloned) {
      // For cloned transactions, hide the opposite side
      hideFields = {
        debit: transaction.clonedType === 'credit',
        credit: transaction.clonedType === 'debit',
      };
      setIsClonedTransaction(true);
    } else {
      // For regular transactions, determine which fields to hide based on amounts
      hideFields = {
        debit: transaction.debit_amount === 0,
        credit: transaction.credit_amount === 0,
      };
      setIsClonedTransaction(false);
    }
    
    setHiddenFieldsInEdit(hideFields);
    setEditingTransaction(transaction);
    setEditingTransactionIndex(index);
    setShowEditDialog(true);
  };

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    // Reload transactions if editing existing document
    if (document?.id) {
      loadTransactions(document.id);
    } else {
      // For new documents, update the local transactions array
      if (editingTransactionIndex !== null) {
        setTransactions(prev => {
          const updated = [...prev];
          // Preserve the cloned properties when updating
          if (isClonedTransaction) {
            updatedTransaction.isCloned = true;
            updatedTransaction.clonedType = updated[editingTransactionIndex].clonedType;
          }
          updated[editingTransactionIndex] = updatedTransaction;
          return updated;
        });
      }
    }
    setShowEditDialog(false);
    setEditingTransaction(null);
    setEditingTransactionIndex(null);
    // Don't reset hiddenFieldsInEdit here to preserve the hidden state
    // setHiddenFieldsInEdit({});
    setIsClonedTransaction(false);
  };

  // Calculate separate sums for debit and credit using the new columns
  const debitTotal = transactions.reduce((sum, t) => {
    const debitAmount = t.debit_amount !== undefined ? t.debit_amount : t.amount;
    return sum + debitAmount;
  }, 0);
  
  const creditTotal = transactions.reduce((sum, t) => {
    const creditAmount = t.credit_amount !== undefined ? t.credit_amount : t.amount;
    return sum + creditAmount;
  }, 0);

  console.log('Transactions:', transactions);
  console.log('Debit total:', debitTotal);
  console.log('Credit total:', creditTotal);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {document ? 'Edytuj dokument' : 'Nowy dokument'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd MMMM yyyy", { locale: pl })
                            ) : (
                              <span>Wybierz datę</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <Button type="button" variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Zapisywanie...' : (document ? 'Zapisz zmiany' : 'Utwórz dokument')}
              </Button>
            </div>
          </form>
        </Form>

        {/* Transactions section - outside the main form to prevent nesting */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Transakcje</h3>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTransactionForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Dodaj transakcję
            </Button>
          </div>

          {transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.map((transaction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-gray-600">
                      {transaction.debit_amount !== undefined && transaction.debit_amount > 0 && (
                        <span className="ml-2 text-green-600">
                          Winien: {transaction.debit_amount.toLocaleString('pl-PL', { 
                            style: 'currency', 
                            currency: 'PLN' 
                          })}
                        </span>
                      )}
                      {transaction.credit_amount !== undefined && transaction.credit_amount > 0 && (
                        <span className="ml-2 text-blue-600">
                          Ma: {transaction.credit_amount.toLocaleString('pl-PL', { 
                            style: 'currency', 
                            currency: 'PLN' 
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateDebitSide(index)}
                      className="text-green-600 hover:text-green-700"
                      title="Powiel stronę Winien"
                    >
                      <Copy className="h-4 w-4" />
                      W
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateCreditSide(index)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Powiel stronę Ma"
                    >
                      <Copy className="h-4 w-4" />
                      M
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTransaction(transaction, index)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTransaction(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Updated summary section with separate debit and credit totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-medium text-green-700">Winien:</span>
                  <span className="font-semibold text-green-700">
                    {debitTotal.toLocaleString('pl-PL', { 
                      style: 'currency', 
                      currency: 'PLN' 
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span className="font-medium text-blue-700">Ma:</span>
                  <span className="font-semibold text-blue-700">
                    {creditTotal.toLocaleString('pl-PL', { 
                      style: 'currency', 
                      currency: 'PLN' 
                    })}
                  </span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Razem:</span>
                    <span>
                      {(debitTotal + creditTotal).toLocaleString('pl-PL', { 
                        style: 'currency', 
                        currency: 'PLN' 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showTransactionForm && (
            <TransactionForm
              onAdd={addTransaction}
              onCancel={() => setShowTransactionForm(false)}
            />
          )}
        </div>
      </DialogContent>

      {/* Transaction Edit Dialog */}
      <TransactionEditDialog
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingTransaction(null);
          setEditingTransactionIndex(null);
          setHiddenFieldsInEdit({});
          setIsClonedTransaction(false);
        }}
        onSave={handleTransactionUpdated}
        transaction={editingTransaction}
        isNewDocument={!document}
        hiddenFields={hiddenFieldsInEdit}
      />
    </Dialog>
  );
};

export default DocumentDialog;
