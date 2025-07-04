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
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parallelTransactions, setParallelTransactions] = useState<Transaction[]>([]);
  const [editingTransactionIndex, setEditingTransactionIndex] = useState<number | null>(null);
  const [editingParallelTransactionIndex, setEditingParallelTransactionIndex] = useState<number | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showParallelInlineForm, setShowParallelInlineForm] = useState(false);
  const [showParallelSection, setShowParallelSection] = useState(false);
  const form = useForm<DocumentFormData>({
    defaultValues: {
      document_number: '',
      document_name: '',
      document_date: new Date(),
      currency: 'PLN'
    }
  });

  // Get user's location from profile
  const {
    data: userProfile
  } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('profiles').select('location_id').eq('id', user?.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get location settings to check if foreign currencies are allowed
  const {
    data: locationSettings
  } = useQuery({
    queryKey: ['locationSettings', userProfile?.location_id],
    queryFn: async () => {
      if (!userProfile?.location_id) return null;
      const {
        data,
        error
      } = await supabase.from('location_settings').select('allow_foreign_currencies').eq('location_id', userProfile.location_id).single();
      if (error) return {
        allow_foreign_currencies: false
      };
      return data;
    },
    enabled: !!userProfile?.location_id
  });

  // Check if editing is blocked for this document
  const documentDate = form.watch('document_date');
  const {
    data: isEditingBlocked,
    isLoading: checkingBlock
  } = useQuery({
    queryKey: ['editingBlocked', document?.id, userProfile?.location_id, documentDate],
    queryFn: async () => {
      if (!userProfile?.location_id || !documentDate) return false;
      const {
        data,
        error
      } = await supabase.rpc('check_report_editing_blocked', {
        p_location_id: userProfile.location_id,
        p_document_date: format(documentDate, 'yyyy-MM-dd')
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.location_id && !!documentDate && isOpen
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

  // Auto-show inline form when document is new and no transactions exist
  useEffect(() => {
    if (isOpen && !document && transactions.length === 0 && !showInlineForm) {
      setShowInlineForm(true);
    }
  }, [isOpen, document, transactions.length, showInlineForm]);

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
        variant: "destructive"
      });
      return '';
    }
    setIsGeneratingNumber(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // JavaScript months are 0-indexed

      const {
        data,
        error
      } = await supabase.rpc('generate_document_number', {
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

  // Load document data when editing
  useEffect(() => {
    if (document) {
      form.reset({
        document_number: document.document_number,
        document_name: document.document_name,
        document_date: new Date(document.document_date),
        currency: document.currency || 'PLN'
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
        currency: 'PLN'
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
      const subscription = form.watch((value, {
        name
      }) => {
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
      const {
        data: accounts,
        error
      } = await supabase.from('accounts').select('id, number, name').in('id', Array.from(accountIds));
      if (error) throw error;
      const accountsMap = new Map(accounts?.map(acc => [acc.id, acc]) || []);
      return transactionsToLoad.map(transaction => ({
        ...transaction,
        debitAccountNumber: accountsMap.get(transaction.debit_account_id)?.number || '',
        creditAccountNumber: accountsMap.get(transaction.credit_account_id)?.number || '',
        debitAccount: accountsMap.get(transaction.debit_account_id),
        creditAccount: accountsMap.get(transaction.credit_account_id)
      }));
    } catch (error) {
      console.error('Error loading account numbers:', error);
      return transactionsToLoad;
    }
  };
  const loadTransactions = async (documentId: string) => {
    try {
      console.log('Loading transactions for document:', documentId);
      const {
        data,
        error
      } = await supabase.from('transactions').select('*').eq('document_id', documentId);
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
        description: "Numer dokumentu został wygenerowany ponownie"
      });
    }
  };

  // Handle parallel posting
  const handleParallelPosting = (transactionIndex: number) => {
    const transactionToCopy = transactions[transactionIndex];
    if (!transactionToCopy) return;

    // Create a copy of the transaction
    const copiedTransaction: Transaction = {
      ...transactionToCopy,
      // Remove any IDs to make it a new transaction
      id: undefined
    };

    // Show parallel section if not already shown
    setShowParallelSection(true);

    // Add the copied transaction to parallel transactions
    setParallelTransactions(prev => [...prev, copiedTransaction]);
    toast({
      title: "Sukces",
      description: "Transakcja została skopiowana do księgowania równoległego"
    });
  };
  const addParallelTransaction = async (transaction: Transaction) => {
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([transaction]);
    setParallelTransactions(prev => [...prev, transactionWithAccountNumbers[0]]);
    setShowParallelInlineForm(false);

    // Automatically show new inline form for next transaction
    setTimeout(() => {
      setShowParallelInlineForm(true);
    }, 100);
  };
  const removeParallelTransaction = (index: number) => {
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można usuwać operacji - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive"
      });
      return;
    }
    setParallelTransactions(prev => prev.filter((_, i) => i !== index));
  };
  const handleEditParallelTransaction = (index: number) => {
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można edytować operacji - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive"
      });
      return;
    }
    setEditingParallelTransactionIndex(index);
  };
  const handleSaveParallelTransaction = async (index: number, updatedTransaction: Transaction) => {
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([updatedTransaction]);
    setParallelTransactions(prev => prev.map((t, i) => i === index ? transactionWithAccountNumbers[0] : t));
    setEditingParallelTransactionIndex(null);
  };
  const handleCancelParallelEdit = () => {
    setEditingParallelTransactionIndex(null);
  };
  const handleEditParallelTransactionWithBalancing = async (index: number, updatedTransaction: Transaction) => {
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([updatedTransaction]);
    setParallelTransactions(prev => prev.map((t, i) => i === index ? transactionWithAccountNumbers[0] : t));
    setEditingParallelTransactionIndex(null);

    // Check if amounts don't match and create balancing transaction
    if (Math.abs(updatedTransaction.debit_amount! - updatedTransaction.credit_amount!) > 0.01) {
      const difference = Math.abs(updatedTransaction.debit_amount! - updatedTransaction.credit_amount!);

      // Create balancing transaction
      const balancingTransaction: Transaction = {
        description: updatedTransaction.description,
        debit_account_id: updatedTransaction.debit_amount! > updatedTransaction.credit_amount! ? '' : updatedTransaction.credit_account_id,
        credit_account_id: updatedTransaction.credit_amount! > updatedTransaction.debit_amount! ? '' : updatedTransaction.debit_account_id,
        debit_amount: updatedTransaction.debit_amount! > updatedTransaction.credit_amount! ? 0 : difference,
        credit_amount: updatedTransaction.credit_amount! > updatedTransaction.debit_amount! ? 0 : difference,
        amount: difference,
        settlement_type: updatedTransaction.settlement_type,
        currency: updatedTransaction.currency
      };

      // Add balancing transaction after a short delay
      setTimeout(async () => {
        const balancingTransactionWithAccountNumbers = await loadAccountNumbersForTransactions([balancingTransaction]);
        setParallelTransactions(prev => [...prev, balancingTransactionWithAccountNumbers[0]]);
      }, 200);
    }
  };

  // Calculate totals for parallel transactions
  const parallelDebitTotal = parallelTransactions.reduce((sum, t) => {
    const debitAmount = t.debit_amount !== undefined ? t.debit_amount : t.amount;
    return sum + debitAmount;
  }, 0);
  const parallelCreditTotal = parallelTransactions.reduce((sum, t) => {
    const creditAmount = t.credit_amount !== undefined ? t.credit_amount : t.amount;
    return sum + creditAmount;
  }, 0);
  const onSubmit = async (data: DocumentFormData) => {
    if (!user?.location || !user?.id) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji lub ID użytkownika",
        variant: "destructive"
      });
      return;
    }

    // Check if saving is blocked only when trying to save
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można zapisać dokumentu - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive"
      });
      return;
    }

    // Combine regular and parallel transactions for validation
    const allTransactions = [...transactions, ...parallelTransactions];

    // Walidacja - sprawdź czy są jakieś transakcje
    if (allTransactions.length === 0) {
      toast({
        title: "Błąd walidacji",
        description: "Dokument musi zawierać co najmniej jedną operację",
        variant: "destructive"
      });
      return;
    }

    // Walidacja bilansowości dokumentu - wszystkie transakcje razem
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
        description: "Suma kwot Winien i Ma musi być równa (łącznie z księgowaniem równoległym)",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      let documentId = document?.id;
      console.log('Creating/updating document with user_id:', user.id);
      if (document) {
        // Update existing document - NAPRAWKA: dodajemy currency do aktualizacji
        const {
          error
        } = await supabase.from('documents').update({
          document_number: data.document_number,
          document_name: data.document_name,
          document_date: format(data.document_date, 'yyyy-MM-dd'),
          currency: data.currency // NAPRAWKA: zapisujemy walutę przy aktualizacji
        }).eq('id', document.id);
        if (error) throw error;
      } else {
        // Create new document
        const {
          data: newDocument,
          error
        } = await supabase.from('documents').insert({
          document_number: data.document_number,
          document_name: data.document_name,
          document_date: format(data.document_date, 'yyyy-MM-dd'),
          location_id: user.location,
          user_id: user.id,
          currency: data.currency // Waluta jest już ustawiana przy tworzeniu
        }).select().single();
        if (error) {
          console.error('Error creating document:', error);
          throw error;
        }
        console.log('Document created successfully:', newDocument);
        documentId = newDocument.id;
      }

      // Combine all transactions for saving and set their currency
      const allTransactionsSafe = allTransactions.map((t, idx) => ({
        ...t,
        currency: data.currency,
        description: typeof t.description === "string" && t.description.trim() !== "" ? t.description : ""
      }));

      // Save all transactions
      if (documentId) {
        // First, delete existing transactions if editing
        const {
          error: deleteError
        } = await supabase.from('transactions').delete().eq('document_id', documentId);
        if (deleteError) {
          console.error('Error deleting existing transactions:', deleteError);
          throw deleteError;
        }

        // Insert new/updated transactions
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
              settlement_type: t.settlement_type,
              currency: t.currency,
              date: format(data.document_date, 'yyyy-MM-dd'),
              location_id: user.location,
              user_id: user.id,
              document_number: data.document_number
            };
          });
          console.log('Inserting transactions:', transactionsToInsert);
          const {
            error: transactionError
          } = await supabase.from('transactions').insert(transactionsToInsert);
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
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([transactionWithCurrency]);
    setTransactions(prev => [...prev, transactionWithAccountNumbers[0]]);
    setShowInlineForm(false);

    // Automatically show new inline form for next transaction
    setTimeout(() => {
      setShowInlineForm(true);
    }, 100);
  };
  const removeTransaction = (index: number) => {
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można usuwać operacji - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive"
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
        variant: "destructive"
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

  // New function to handle auto-balancing for edited transactions
  const handleEditTransactionWithBalancing = async (index: number, updatedTransaction: Transaction) => {
    const transactionWithAccountNumbers = await loadAccountNumbersForTransactions([updatedTransaction]);
    setTransactions(prev => prev.map((t, i) => i === index ? transactionWithAccountNumbers[0] : t));
    setEditingTransactionIndex(null);

    // Check if amounts don't match and create balancing transaction
    if (Math.abs(updatedTransaction.debit_amount! - updatedTransaction.credit_amount!) > 0.01) {
      const difference = Math.abs(updatedTransaction.debit_amount! - updatedTransaction.credit_amount!);

      // Create balancing transaction - only fill the side that was originally smaller
      const balancingTransaction: Transaction = {
        description: updatedTransaction.description,
        debit_account_id: updatedTransaction.debit_amount! > updatedTransaction.credit_amount! ? '' : updatedTransaction.credit_account_id,
        credit_account_id: updatedTransaction.credit_amount! > updatedTransaction.debit_amount! ? '' : updatedTransaction.debit_account_id,
        debit_amount: updatedTransaction.debit_amount! > updatedTransaction.credit_amount! ? 0 : difference,
        credit_amount: updatedTransaction.credit_amount! > updatedTransaction.debit_amount! ? 0 : difference,
        amount: difference,
        settlement_type: updatedTransaction.settlement_type,
        currency: updatedTransaction.currency
      };

      // Add balancing transaction after a short delay
      setTimeout(async () => {
        const balancingTransactionWithAccountNumbers = await loadAccountNumbersForTransactions([balancingTransaction]);
        setTransactions(prev => [...prev, balancingTransactionWithAccountNumbers[0]]);
      }, 200);
    }
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

  // Get currency symbol
  const getCurrencySymbol = (currency: string) => {
    const currencySymbols: {
      [key: string]: string;
    } = {
      'PLN': 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr',
      'SEK': 'kr'
    };
    return currencySymbols[currency] || currency;
  };
  const formatAmount = (amount: number, currency: string = 'PLN') => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ${symbol}`;
  };
  console.log('Transactions:', transactions);
  console.log('Debit total:', debitTotal);
  console.log('Credit total:', creditTotal);
  if (checkingBlock) {
    return <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sprawdzanie uprawnień...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Sprawdzanie czy dokument może być edytowany...</div>
        </DialogContent>
      </Dialog>;
  }
  const selectedCurrency = form.watch('currency');
  return <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {document ? 'Edytuj dokument' : 'Nowy dokument'}
            </DialogTitle>
          </DialogHeader>

          {/* Show warning only when editing is blocked and we have a date */}
          {isEditingBlocked && documentDate && <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nie można zapisać dokumentu na datę {format(documentDate, 'dd.MM.yyyy')}, 
                ponieważ raport za ten okres został już złożony lub zatwierdzony.
                {!document && " Możesz wybrać inną datę."}
              </AlertDescription>
            </Alert>}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="document_number" render={({
                field
              }) => <FormItem>
                      <FormLabel>Numer dokumentu</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input {...field} placeholder="np. DOM/2024/01/001" />
                        </FormControl>
                        {!document && <Button type="button" variant="outline" size="sm" onClick={handleRegenerateNumber} disabled={isGeneratingNumber} title="Wygeneruj ponownie numer dokumentu">
                            <RefreshCw className={cn("h-4 w-4", isGeneratingNumber && "animate-spin")} />
                          </Button>}
                      </div>
                      <FormMessage />
                    </FormItem>} />

                <FormField control={form.control} name="document_date" render={({
                field
              }) => <FormItem>
                      <FormLabel>Data dokumentu</FormLabel>
                      <FormControl>
                        <DatePicker value={field.value} onChange={field.onChange} placeholder="Wybierz datę" disabled={date => date > new Date() || date < new Date("1900-01-01")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />

                <FormField control={form.control} name="currency" render={({
                field
              }) => <FormItem>
                      
                      <FormControl>
                        <CurrencySelector value={field.value} onChange={field.onChange} disabled={!locationSettings?.allow_foreign_currencies || isEditingBlocked} />
                      </FormControl>
                      <FormMessage />
                      {!locationSettings?.allow_foreign_currencies && <p className="text-sm text-gray-500">
                          Obsługa walut obcych wyłączona dla tej placówki
                        </p>}
                    </FormItem>} />
              </div>

              <FormField control={form.control} name="document_name" render={({
              field
            }) => <FormItem>
                    <FormLabel>Nazwa dokumentu</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opisowa nazwa dokumentu" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                setHasUnsavedChanges(false);
                onClose();
              }}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={isLoading || isEditingBlocked && Boolean(documentDate)}>
                  {isLoading ? 'Zapisywanie...' : document ? 'Zapisz zmiany' : 'Utwórz dokument'}
                </Button>
              </div>
            </form>
          </Form>

          {/* Main Operations section */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Operacje główne</h3>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowParallelSection(!showParallelSection)} className="flex items-center gap-2" disabled={isEditingBlocked}>
                  <Copy className="h-4 w-4" />
                  Księgowanie równoległe
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowInlineForm(true)} className="flex items-center gap-2" disabled={isEditingBlocked || showInlineForm}>
                  <Plus className="h-4 w-4" />
                  Dodaj operację
                </Button>
              </div>
            </div>

            {/* Main transaction table */}
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
                    {transactions.map((transaction, index) => <InlineEditTransactionRow key={index} transaction={transaction} index={index} isEditing={editingTransactionIndex === index} onEdit={() => handleEditTransaction(index)} onSave={updatedTransaction => handleEditTransactionWithBalancing(index, updatedTransaction)} onCancel={handleCancelEdit} onDelete={() => removeTransaction(index)} onParallelPosting={() => handleParallelPosting(index)} isEditingBlocked={isEditingBlocked} locationId={userProfile?.location_id} showCopyButton={showParallelSection} currency={selectedCurrency} />)}
                    
                    {/* Inline form row for adding new transactions */}
                    {showInlineForm && <InlineTransactionRow onSave={addTransaction} isEditingBlocked={isEditingBlocked} showCopyButton={showParallelSection} currency={selectedCurrency} />}
                  </TableBody>
                </Table>
              </div>
              
              {/* Main summary section */}
              {transactions.length > 0 && <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium text-green-700">Winien:</span>
                    <span className="font-semibold text-green-700">
                      {formatAmount(debitTotal, selectedCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium text-blue-700">Ma:</span>
                    <span className="font-semibold text-blue-700">
                      {formatAmount(creditTotal, selectedCurrency)}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center text-xl font-bold">
                      <span>Razem:</span>
                      <span>
                        {formatAmount(debitTotal + creditTotal, selectedCurrency)}
                      </span>
                    </div>
                  </div>
                  {/* Balance check indicator */}
                  {Math.abs(debitTotal - creditTotal) > 0.01 && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Operacje główne nie są zbilansowane. Różnica: {formatAmount(Math.abs(debitTotal - creditTotal), selectedCurrency)}
                        </span>
                      </div>
                    </div>}
                </div>}
            </div>
          </div>

          {/* Parallel Operations section */}
          {showParallelSection && <div className="space-y-4 border-t pt-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-purple-800">Księgowanie równoległe</h3>
                <Button type="button" variant="outline" onClick={() => setShowParallelInlineForm(true)} className="flex items-center gap-2" disabled={isEditingBlocked || showParallelInlineForm}>
                  <Plus className="h-4 w-4" />
                  Dodaj operację równoległą
                </Button>
              </div>

              {/* Parallel transaction table */}
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
                      {parallelTransactions.map((transaction, index) => <InlineEditTransactionRow key={index} transaction={transaction} index={index} isEditing={editingParallelTransactionIndex === index} onEdit={() => handleEditParallelTransaction(index)} onSave={updatedTransaction => handleEditParallelTransactionWithBalancing(index, updatedTransaction)} onCancel={handleCancelParallelEdit} onDelete={() => removeParallelTransaction(index)} isEditingBlocked={isEditingBlocked} locationId={userProfile?.location_id} isParallel={true} showCopyButton={false} currency={selectedCurrency} />)}
                      
                      {/* Inline form row for adding new parallel transactions */}
                      {showParallelInlineForm && <InlineTransactionRow onSave={addParallelTransaction} isEditingBlocked={isEditingBlocked} showCopyButton={false} currency={selectedCurrency} />}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Parallel summary section */}
                {parallelTransactions.length > 0 && <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-medium text-green-700">Winien (równoległe):</span>
                      <span className="font-semibold text-green-700">
                        {formatAmount(parallelDebitTotal, selectedCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-medium text-blue-700">Ma (równoległe):</span>
                      <span className="font-semibold text-blue-700">
                        {formatAmount(parallelCreditTotal, selectedCurrency)}
                      </span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Razem (równoległe):</span>
                        <span>
                          {formatAmount(parallelDebitTotal + parallelCreditTotal, selectedCurrency)}
                        </span>
                      </div>
                    </div>
                    {/* Balance check indicator for parallel transactions */}
                    {Math.abs(parallelDebitTotal - parallelCreditTotal) > 0.01 && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Księgowanie równoległe nie jest zbilansowane. Różnica: {formatAmount(Math.abs(parallelDebitTotal - parallelCreditTotal), selectedCurrency)}
                          </span>
                        </div>
                      </div>}
                  </div>}
              </div>
            </div>}

          {/* Overall balance summary */}
          {(transactions.length > 0 || parallelTransactions.length > 0) && <div className="border-t pt-4 space-y-2 bg-blue-50 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-blue-800">Podsumowanie całkowite</h4>
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Całkowity bilans dokumentu:</span>
                <span className={cn(Math.abs(debitTotal + parallelDebitTotal - (creditTotal + parallelCreditTotal)) <= 0.01 ? "text-green-600" : "text-red-600")}>
                  {Math.abs(debitTotal + parallelDebitTotal - (creditTotal + parallelCreditTotal)) <= 0.01 ? "ZBILANSOWANE" : `RÓŻNICA: ${formatAmount(Math.abs(debitTotal + parallelDebitTotal - (creditTotal + parallelCreditTotal)), selectedCurrency)}
                  `}
                </span>
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Confirm close dialog */}
      <ConfirmCloseDialog isOpen={showConfirmClose} onConfirm={handleConfirmClose} onCancel={handleCancelClose} onSave={handleSaveAndClose} />
    </>;
};

// Updated inline edit transaction row component
interface InlineEditTransactionRowProps {
  transaction: Transaction;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
  onDelete: () => void;
  onParallelPosting?: () => void;
  isEditingBlocked?: boolean;
  locationId?: string;
  isParallel?: boolean;
  showCopyButton?: boolean;
  currency?: string;
}
const InlineEditTransactionRow: React.FC<InlineEditTransactionRowProps> = ({
  transaction,
  index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onParallelPosting,
  isEditingBlocked = false,
  locationId,
  isParallel = false,
  showCopyButton = false,
  currency = 'PLN'
}) => {
  const [formData, setFormData] = useState({
    description: transaction.description || '',
    debit_account_id: transaction.debit_account_id || '',
    credit_account_id: transaction.credit_account_id || '',
    debit_amount: transaction.debit_amount || 0,
    credit_amount: transaction.credit_amount || 0,
    settlement_type: transaction.settlement_type || 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek'
  });
  const [debitHasFocus, setDebitHasFocus] = useState(false);
  const [creditHasFocus, setCreditHasFocus] = useState(false);
  const [debitTouched, setDebitTouched] = useState(false);
  const [creditTouched, setCreditTouched] = useState(false);

  // Always keep form data in sync with transaction data
  useEffect(() => {
    setFormData({
      description: transaction.description || '',
      debit_account_id: transaction.debit_account_id || '',
      credit_account_id: transaction.credit_account_id || '',
      debit_amount: transaction.debit_amount || 0,
      credit_amount: transaction.credit_amount || 0,
      settlement_type: transaction.settlement_type || 'Bank' as 'Gotówka' | 'Bank' | 'Rozrachunek'
    });
  }, [transaction]);

  // Auto-populate logic based on focus state
  const handleDebitAmountChange = (value: number) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        debit_amount: value
      };

      // Auto-populate credit amount only if:
      // 1. Credit field hasn't been touched by user yet AND
      // 2. Debit field currently has focus AND
      // 3. Credit amount is currently 0
      if (!creditTouched && debitHasFocus && prev.credit_amount === 0) {
        newData.credit_amount = value;
      }
      return newData;
    });
  };
  const handleCreditAmountChange = (value: number) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        credit_amount: value
      };

      // Auto-populate debit amount only if:
      // 1. Debit field hasn't been touched by user yet AND
      // 2. Credit field currently has focus AND
      // 3. Debit amount is currently 0
      if (!debitTouched && creditHasFocus && prev.debit_amount === 0) {
        newData.debit_amount = value;
      }
      return newData;
    });
  };
  const handleDebitFocus = () => {
    setDebitHasFocus(true);
  };
  const handleDebitBlur = () => {
    setDebitHasFocus(false);
    setDebitTouched(true);

    // Auto-save and create balancing transaction if amounts don't match
    if (formData.debit_amount > 0 && formData.credit_amount > 0 && Math.abs(formData.debit_amount - formData.credit_amount) > 0.01 && formData.description.trim() && formData.debit_account_id && formData.credit_account_id) {
      // If debit amount is smaller, trigger save with balancing
      if (formData.debit_amount < formData.credit_amount) {
        handleSave();
      }
    }

    // Copy amount to credit field if credit hasn't been touched and is 0
    if (!creditTouched && formData.credit_amount === 0 && formData.debit_amount > 0) {
      setFormData(prev => ({
        ...prev,
        credit_amount: prev.debit_amount
      }));
    }
  };
  const handleCreditFocus = () => {
    setCreditHasFocus(true);
  };
  const handleCreditBlur = () => {
    setCreditHasFocus(false);
    setCreditTouched(true);

    // Auto-save and create balancing transaction if amounts don't match
    if (formData.debit_amount > 0 && formData.credit_amount > 0 && Math.abs(formData.debit_amount - formData.credit_amount) > 0.01 && formData.description.trim() && formData.debit_account_id && formData.credit_account_id) {
      // If credit amount is smaller, trigger save with balancing
      if (formData.credit_amount < formData.debit_amount) {
        handleSave();
      }
    }

    // Copy amount to debit field if debit hasn't been touched and is 0
    if (!debitTouched && formData.debit_amount === 0 && formData.credit_amount > 0) {
      setFormData(prev => ({
        ...prev,
        debit_amount: prev.credit_amount
      }));
    }
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
      currency: currency
    };
    onSave(updatedTransaction);
  };
  const isFormValid = formData.description.trim() && formData.debit_account_id && formData.credit_account_id && formData.debit_amount > 0 && formData.credit_amount > 0;
  return <TableRow className={cn("border-2", isParallel ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200")}>
      <TableCell>
        <Textarea value={formData.description} onChange={e => setFormData(prev => ({
        ...prev,
        description: e.target.value
      }))} placeholder="Opis operacji..." className="min-h-[60px] resize-none" disabled={isEditingBlocked} />
      </TableCell>
      <TableCell>
        <AccountCombobox value={formData.debit_account_id} onChange={accountId => setFormData(prev => ({
        ...prev,
        debit_account_id: accountId
      }))} locationId={locationId} side="debit" disabled={isEditingBlocked} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" min="0" value={formData.debit_amount || ''} onChange={e => handleDebitAmountChange(parseFloat(e.target.value) || 0)} onFocus={handleDebitFocus} onBlur={handleDebitBlur} placeholder="0.00" className="text-right" disabled={isEditingBlocked} />
      </TableCell>
      <TableCell>
        <AccountCombobox value={formData.credit_account_id} onChange={accountId => setFormData(prev => ({
        ...prev,
        credit_account_id: accountId
      }))} locationId={locationId} side="credit" disabled={isEditingBlocked} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" min="0" value={formData.credit_amount || ''} onChange={e => handleCreditAmountChange(parseFloat(e.target.value) || 0)} onFocus={handleCreditFocus} onBlur={handleCreditBlur} placeholder="0.00" className="text-right" disabled={isEditingBlocked} />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          {!isParallel && onParallelPosting && showCopyButton && <Button type="button" variant="outline" size="sm" onClick={onParallelPosting} disabled={isEditingBlocked} title="Kopiuj do księgowania równoległego">
              <Copy className="h-4 w-4" />
            </Button>}
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700" disabled={isEditingBlocked}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>;
};
export default DocumentDialog;