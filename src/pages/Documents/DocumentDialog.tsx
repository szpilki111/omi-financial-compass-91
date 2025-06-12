
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
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import TransactionForm from './TransactionForm';

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
}

const DocumentDialog = ({ isOpen, onClose, onDocumentCreated, document }: DocumentDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const form = useForm<DocumentFormData>({
    defaultValues: {
      document_number: '',
      document_name: '',
      document_date: new Date(),
    },
  });

  // Load document data when editing
  useEffect(() => {
    if (document) {
      form.reset({
        document_number: document.document_number,
        document_name: document.document_name,
        document_date: new Date(document.document_date),
      });
      
      // Load existing transactions
      loadTransactions(document.id);
    } else {
      form.reset({
        document_number: '',
        document_name: '',
        document_date: new Date(),
      });
      setTransactions([]);
    }
  }, [document, form]);

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
          amount: t.amount,
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

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

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
                    <FormControl>
                      <Input {...field} placeholder="np. DOK/001/2024" />
                    </FormControl>
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
                      Kwota: {transaction.amount.toLocaleString('pl-PL', { 
                        style: 'currency', 
                        currency: 'PLN' 
                      })}
                    </p>
                  </div>
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
              ))}
              <div className="text-right font-medium text-lg">
                Suma: {totalAmount.toLocaleString('pl-PL', { 
                  style: 'currency', 
                  currency: 'PLN' 
                })}
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
    </Dialog>
  );
};

export default DocumentDialog;
