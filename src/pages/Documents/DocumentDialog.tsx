import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Trash2, RefreshCw, Edit, Check, X } from 'lucide-react';
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

const DocumentDialog = ({ isOpen, onClose, onDocumentCreated, document }: DocumentDialogProps) => {
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
    },
  });

  // Get user's location from profile
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('location_id')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if editing is blocked for this document
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
    enabled: !!userProfile?.location_id && !!documentDate && isOpen,
  });

  // Track form changes to detect unsaved changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Track transaction changes
  useEffect(() => {
    if (transactions.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [transactions]);

  // Reset unsaved changes flag when dialog opens for new document
  useEffect(() => {
    if (isOpen && !document) {
      setHasUnsavedChanges(false);
    }
  }, [isOpen, document]);

  // Handle dialog close with confirmation if there are unsaved changes
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      // Dialog is being closed
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
    // Save the document first
    const formData = form.getValues();
    await onSubmit(formData);
    // Close confirmation dialog and main dialog
    setShowConfirmClose(false);
    setHasUnsavedChanges(false);
  };

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
      setHasUnsavedChanges(false);
    } else {
      // For new documents, always start with empty form and no transactions
      form.reset({
        document_number: '',
        document_name: '',
        document_date: new Date(),
      });
      setTransactions([]); // Explicitly clear transactions for new documents
      setHasUnsavedChanges(false);
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

  // Load account numbers for transactions
  const loadAccountNumbersForTransactions = async (transactionsToLoad: Transaction[]) => {
    try {
      const accountIds = new Set<string>();
      transactionsToLoad.forEach(t => {
        if (t.debit_account_id) accountIds.add(t.debit_account_id);
        if (t.credit_account_id) accountIds.add(t.credit_account_id);
      });

      if (accountIds.size === 0) return transactionsToLoad;

      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, number, name')
        .in('id', Array.from(accountIds));

      if (error) throw error;

      const accountsMap = new Map(accounts?.map(acc => [acc.id, acc]) || []);

      return transactionsToLoad.map(transaction => ({
        ...transaction,
        debitAccountNumber: accountsMap.get(transaction.debit_account_id)?.number || '',
        creditAccountNumber: accountsMap.get(transaction.credit_account_id)?.number || '',
        debitAccount: accountsMap.get(transaction.debit_account_id),
        creditAccount: accountsMap.get(transaction.credit_account_id),
      }));
    } catch (error) {
      console.error('Error loading account numbers:', error);
      return transactionsToLoad;
    }
  };

  const loadTransactions = async (documentId: string) => {
    try {
      console.log('Loading transactions for document:', documentId);
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('document_id', documentId);

      if (error) throw error;
      
      console.log('Raw transactions loaded:', data);
      
      // ZAWSZE ładuj numery kont dla transakcji z bazy danych
      const transactionsWithAccountNumbers = await loadAccountNumbersForTransactions(data || []);
      
      console.log('Transactions with account numbers:', transactionsWithAccountNumbers);
      
      setTransactions(transactionsWithAccountNumbers);
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

    // Check if saving is blocked only when trying to save
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można zapisać dokumentu - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive",
      });
      return;
    }

    // Walidacja - sprawdź czy są jakieś transakcje
    if (transactions.length === 0) {
      toast({
        title: "Błąd walidacji",
        description: "Dokument musi zawierać co najmniej jedną operację",
        variant: "destructive",
      });
      return;
    }

    // Walidacja bilansowości dokumentu - suma kwot Winien i Ma musi być równa
    const totalDebit = transactions.reduce((sum, t) => {
      const debitAmount = t.debit_amount !== undefined ? t.debit_amount : 0;
      return sum + debitAmount;
    }, 0);
    
    const totalCredit = transactions.reduce((sum, t) => {
      const creditAmount = t.credit_amount !== undefined ? t.credit_amount : 0;
      return sum + creditAmount;
    }, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) { // Allow for small rounding differences
      toast({
        title: "Błąd walidacji",
        description: "Suma kwot Winien i Ma musi być równa",
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

      // Ensure description is always a string
      const transactionsSafe = transactions.map((t, idx) => ({
        ...t,
        description:
          typeof t.description === "string" && t.description.trim() !== ""
            ? t.description
            : "",
      }));

      // Save transactions if any
      if (documentId) {
        // First, delete existing transactions if editing
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('document_id', documentId);

        if (deleteError) {
          console.error('Error deleting existing transactions:', deleteError);
          throw deleteError;
        }

        // Insert new/updated transactions only if there are any
        if (transactionsSafe.length > 0) {
          const transactionsToInsert = transactionsSafe.map(t => {
            return {
              document_id: documentId,
              debit_account_id: t.debit_account_id || null,
              credit_account_id: t.credit_account_id || null,
              amount: t.amount,
              debit_amount: t.debit_amount !== undefined ? t.debit_amount : 0,
              credit_amount: t.credit_amount !== undefined ? t.credit_amount : 0,
              description: t.description,
              settlement_type: t.settlement_type,
              date: format(data.document_date, 'yyyy-MM-dd'),
              location_id: user.location,
              user_id: user.id,
              document_number: data.document_number,
            };
          });

          console.log('Inserting transactions:', transactionsToInsert);

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert(transactionsToInsert);

          if (transactionError) {
            console.error('Error inserting transactions:', transactionError);
            throw transactionError;
          }

          console.log('Transactions inserted successfully');
        }
      }

      setHasUnsavedChanges(false);
      onDocumentCreated();
      onClose();
      
      toast({
        title: "Sukces",
        description: document ? "Dokument został zaktualizowany" : "Dokument został utworzony",
      });
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

  const addTransaction = async (transaction: Transaction) => {
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([transaction]);
    setTransactions(prev => [...prev, transactionWithAccountNumbers[0]]);
    setShowInlineForm(false);
  };

  const removeTransaction = (index: number) => {
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można usuwać operacji - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive",
      });
      return;
    }
    setTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditTransaction = (index: number) => {
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można edytować operacji - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive",
      });
      return;
    }
    setEditingTransactionIndex(index);
  };

  const handleSaveTransaction = async (index: number, updatedTransaction: Transaction) => {
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([updatedTransaction]);
    setTransactions(prev => prev.map((t, i) => i === index ? transactionWithAccountNumbers[0] : t));
    setEditingTransactionIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingTransactionIndex(null);
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {document ? 'Edytuj dokument' : 'Nowy dokument'}
            </DialogTitle>
          </DialogHeader>

          {/* Show warning only when editing is blocked and we have a date */}
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
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Wybierz datę"
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                        />
                      </FormControl>
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

          {/* Operations section with integrated table */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Operacje</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInlineForm(true)}
                className="flex items-center gap-2"
                disabled={isEditingBlocked || showInlineForm}
              >
                <Plus className="h-4 w-4" />
                Dodaj operację
              </Button>
            </div>

            {/* Transaction table with inline editing */}
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
                      <InlineEditTransactionRow
                        key={index}
                        transaction={transaction}
                        index={index}
                        isEditing={editingTransactionIndex === index}
                        onEdit={() => handleEditTransaction(index)}
                        onSave={(updatedTransaction) => handleSaveTransaction(index, updatedTransaction)}
                        onCancel={handleCancelEdit}
                        onDelete={() => removeTransaction(index)}
                        isEditingBlocked={isEditingBlocked}
                        locationId={userProfile?.location_id}
                      />
                    ))}
                    
                    {/* Inline form row for adding new transactions */}
                    {showInlineForm && (
                      <InlineTransactionRow
                        onSave={addTransaction}
                        onCancel={() => setShowInlineForm(false)}
                        isEditingBlocked={isEditingBlocked}
                      />
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Summary section */}
              {transactions.length > 0 && (
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
                  {/* Balance check indicator */}
                  {Math.abs(debitTotal - creditTotal) > 0.01 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Dokument nie jest zbilansowany. Różnica: {Math.abs(debitTotal - creditTotal).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm close dialog */}
      <ConfirmCloseDialog
        isOpen={showConfirmClose}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        onSave={handleSaveAndClose}
      />
    </>
  );
};

// New inline edit transaction row component
interface InlineEditTransactionRowProps {
  transaction: Transaction;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
  onDelete: () => void;
  isEditingBlocked?: boolean;
  locationId?: string;
}

const InlineEditTransactionRow: React.FC<InlineEditTransactionRowProps> = ({
  transaction,
  index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  isEditingBlocked = false,
  locationId,
}) => {
  const [formData, setFormData] = useState({
    description: transaction.description || '',
    debit_account_id: transaction.debit_account_id || '',
    credit_account_id: transaction.credit_account_id || '',
    debit_amount: transaction.debit_amount || 0,
    credit_amount: transaction.credit_amount || 0,
    settlement_type: transaction.settlement_type || 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
  });

  const [hasUserEditedDebit, setHasUserEditedDebit] = useState(false);
  const [hasUserEditedCredit, setHasUserEditedCredit] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setFormData({
        description: transaction.description || '',
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        debit_amount: transaction.debit_amount || 0,
        credit_amount: transaction.credit_amount || 0,
        settlement_type: transaction.settlement_type || 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek',
      });
      setHasUserEditedDebit(false);
      setHasUserEditedCredit(false);
    }
  }, [isEditing, transaction]);

  // Auto-balance amounts with improved logic
  const handleDebitAmountChange = (value: number) => {
    setHasUserEditedDebit(true);
    setFormData(prev => ({
      ...prev,
      debit_amount: value,
      // Only auto-populate credit if credit hasn't been manually edited and it's currently 0
      credit_amount: !hasUserEditedCredit && prev.credit_amount === 0 ? value : prev.credit_amount,
    }));
  };

  const handleCreditAmountChange = (value: number) => {
    setHasUserEditedCredit(true);
    setFormData(prev => ({
      ...prev,
      credit_amount: value,
      // Only auto-populate debit if debit hasn't been manually edited and it's currently 0
      debit_amount: !hasUserEditedDebit && prev.debit_amount === 0 ? value : prev.debit_amount,
    }));
  };

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
      settlement_type: formData.settlement_type,
    };

    onSave(updatedTransaction);
  };

  const isFormValid = formData.description.trim() && 
                     formData.debit_account_id && 
                     formData.credit_account_id && 
                     formData.debit_amount > 0 && 
                     formData.credit_amount > 0;

  if (isEditing) {
    return (
      <TableRow className="bg-blue-50 border-2 border-blue-200">
        <TableCell>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Opis operacji..."
            className="min-h-[60px] resize-none"
            disabled={isEditingBlocked}
          />
        </TableCell>
        <TableCell>
          <AccountCombobox
            value={formData.debit_account_id}
            onChange={(accountId) => setFormData(prev => ({ ...prev, debit_account_id: accountId }))}
            locationId={locationId}
            side="debit"
            disabled={isEditingBlocked}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.debit_amount || ''}
            onChange={(e) => handleDebitAmountChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="text-right"
            disabled={isEditingBlocked}
          />
        </TableCell>
        <TableCell>
          <AccountCombobox
            value={formData.credit_account_id}
            onChange={(accountId) => setFormData(prev => ({ ...prev, credit_account_id: accountId }))}
            locationId={locationId}
            side="credit"
            disabled={isEditingBlocked}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.credit_amount || ''}
            onChange={(e) => handleCreditAmountChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="text-right"
            disabled={isEditingBlocked}
          />
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!isFormValid || isEditingBlocked}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isEditingBlocked}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {transaction.description}
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {transaction.debitAccountNumber && (
            <span className="text-gray-600">
              {transaction.debitAccountNumber}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {transaction.debit_amount !== undefined && transaction.debit_amount > 0 && (
          <span className="font-medium text-green-600">
            {transaction.debit_amount.toLocaleString('pl-PL', { 
              style: 'currency', 
              currency: 'PLN' 
            })}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {transaction.creditAccountNumber && (
            <span className="text-gray-600">
              {transaction.creditAccountNumber}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {transaction.credit_amount !== undefined && transaction.credit_amount > 0 && (
          <span className="font-medium text-blue-600">
            {transaction.credit_amount.toLocaleString('pl-PL', { 
              style: 'currency', 
              currency: 'PLN' 
            })}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-700"
            disabled={isEditingBlocked}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700"
            disabled={isEditingBlocked}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default DocumentDialog;
