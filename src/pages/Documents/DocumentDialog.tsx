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
import { Plus, Trash2, RefreshCw, Copy, BookOpen, Split } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import ConfirmCloseDialog from './ConfirmCloseDialog';
import InlineTransactionRow from './InlineTransactionRow';
import { AccountCombobox } from './AccountCombobox';
import { Transaction } from './types';
import CurrencySelector from '@/components/CurrencySelector';
import { Checkbox } from '@/components/ui/checkbox';

interface DocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: () => void;
  document?: any;
}

interface ValidationError {
  type: 'inline_form' | 'parallel_inline_form' | 'incomplete_transaction' | 'no_operations';
  transactionIndex?: number;
  isParallel?: boolean;
  missingFields?: {
    description?: boolean;
    debit_amount?: boolean;
    credit_amount?: boolean;
    debit_account_id?: boolean;
    credit_account_id?: boolean;
  };
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
  const [parallelTransactions, setParallelTransactions] = useState<Transaction[]>([]);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showParallelInlineForm, setShowParallelInlineForm] = useState(false);
  const [showParallelAccounting, setShowParallelAccounting] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [selectedParallelTransactions, setSelectedParallelTransactions] = useState<number[]>([]);
  const [hasInlineFormData, setHasInlineFormData] = useState(false);
  const [hasParallelInlineFormData, setHasParallelInlineFormData] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const form = useForm<DocumentFormData>({
    defaultValues: {
      document_number: '',
      document_name: '',
      document_date: new Date(),
      currency: 'PLN'
    }
  });

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
    if (transactions.length > 0 || parallelTransactions.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [transactions, parallelTransactions]);

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

  // Add warning before closing browser/tab when dialog is open
  useEffect(() => {
    if (!isOpen) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen]);

  const checkLastTransactionComplete = () => {
    const errors: ValidationError[] = [];
    
    // Check if inline form has unsaved data
    if (hasInlineFormData) {
      errors.push({ type: 'inline_form' });
      toast({
        title: "Błąd walidacji",
        description: "Masz wprowadzone dane w formularzu operacji głównych. Dokończ dodawanie operacji lub wyczyść formularz przed zamknięciem.",
        variant: "destructive"
      });
      setValidationErrors(errors);
      return false;
    }

    // Check if parallel inline form has unsaved data  
    if (hasParallelInlineFormData) {
      errors.push({ type: 'parallel_inline_form' });
      toast({
        title: "Błąd walidacji", 
        description: "Masz wprowadzone dane w formularzu operacji równoległych. Dokończ dodawanie operacji lub wyczyść formularz przed zamknięciem.",
        variant: "destructive"
      });
      setValidationErrors(errors);
      return false;
    }

    // Check for incomplete existing transactions
    transactions.forEach((transaction, index) => {
      const hasDescription = transaction.description && transaction.description.trim() !== '';
      const hasDebitAmount = transaction.debit_amount > 0;
      const hasCreditAmount = transaction.credit_amount > 0;
      const hasAnyAmount = hasDebitAmount || hasCreditAmount;
      const hasDebitAccount = !!transaction.debit_account_id;
      const hasCreditAccount = !!transaction.credit_account_id;
      
      // Transaction is incomplete if it has any data but missing required fields
      if (hasDescription || hasAnyAmount || hasDebitAccount || hasCreditAccount) {
        const missingFields: ValidationError['missingFields'] = {};
        
        if (!hasDescription) missingFields.description = true;
        if (!hasDebitAmount && !hasCreditAmount) {
          missingFields.debit_amount = true;
          missingFields.credit_amount = true;
        }
        if (!hasDebitAccount) missingFields.debit_account_id = true;
        if (!hasCreditAccount) missingFields.credit_account_id = true;
        
        if (Object.keys(missingFields).length > 0) {
          errors.push({ 
            type: 'incomplete_transaction', 
            transactionIndex: index, 
            isParallel: false,
            missingFields 
          });
        }
      }
    });

    parallelTransactions.forEach((transaction, index) => {
      const hasDescription = transaction.description && transaction.description.trim() !== '';
      const hasDebitAmount = transaction.debit_amount > 0;
      const hasCreditAmount = transaction.credit_amount > 0;
      const hasAnyAmount = hasDebitAmount || hasCreditAmount;
      const hasDebitAccount = !!transaction.debit_account_id;
      const hasCreditAccount = !!transaction.credit_account_id;
      
      // Transaction is incomplete if it has any data but missing required fields
      if (hasDescription || hasAnyAmount || hasDebitAccount || hasCreditAccount) {
        const missingFields: ValidationError['missingFields'] = {};
        
        if (!hasDescription) missingFields.description = true;
        if (!hasDebitAmount && !hasCreditAmount) {
          missingFields.debit_amount = true;
          missingFields.credit_amount = true;
        }
        if (!hasDebitAccount) missingFields.debit_account_id = true;
        if (!hasCreditAccount) missingFields.credit_account_id = true;
        
        if (Object.keys(missingFields).length > 0) {
          errors.push({ 
            type: 'incomplete_transaction', 
            transactionIndex: index, 
            isParallel: true,
            missingFields 
          });
        }
      }
    });

    if (errors.length > 0) {
      const incompleteCount = errors.filter(e => e.type === 'incomplete_transaction').length;
      toast({
        title: "Błąd walidacji",
        description: `Istnieją ${incompleteCount} niekompletne operacje z wprowadzonymi danymi. Uzupełnij wszystkie pola lub usuń niekompletne operacje przed zamknięciem.`,
        variant: "destructive"
      });
      setValidationErrors(errors);
      return false;
    }
    
    setValidationErrors([]);
    return true;
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (hasUnsavedChanges) {
        if (!checkLastTransactionComplete()) {
          return; // Block closing if last transaction is incomplete
        }
        setShowConfirmClose(true);
      } else {
        onClose();
      }
    }
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      if (!checkLastTransactionComplete()) {
        return; // Block closing if last transaction is incomplete
      }
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

  const handleRegenerateNumber = async () => {
    const currentDate = form.getValues('document_date');
    const generatedNumber = await generateDocumentNumber(currentDate);
    if (generatedNumber) {
      form.setValue('document_number', generatedNumber);
    }
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
      setParallelTransactions([]);
      setHasUnsavedChanges(false);
    }
  }, [document, form, isOpen]);

  useEffect(() => {
    if (isOpen && !document) {
      setTransactions([]);
      setParallelTransactions([]);
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

  const sortTransactionsWithParents = (transactions: Transaction[]): Transaction[] => {
    const result: Transaction[] = [];
    const parentMap = new Map<string, Transaction[]>();
    
    // Group children by parent
    transactions.forEach(t => {
      if (t.parent_transaction_id) {
        const siblings = parentMap.get(t.parent_transaction_id) || [];
        siblings.push(t);
        parentMap.set(t.parent_transaction_id, siblings);
      }
    });
    
    // Build sorted list with children immediately after parents
    transactions.forEach(t => {
      if (!t.parent_transaction_id) {
        result.push(t);
        const children = parentMap.get(t.id!);
        if (children) {
          result.push(...children);
        }
      }
    });
    
    return result;
  };

  const loadTransactions = async (documentId: string) => {
    try {
      const { data, error } = await supabase.from('transactions').select('*').eq('document_id', documentId);
      if (error) throw error;
      const sorted = sortTransactionsWithParents(data || []);
      setTransactions(sorted);
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

    const allTransactions = [...transactions, ...parallelTransactions];
    const errors: ValidationError[] = [];

    if (allTransactions.length === 0) {
      errors.push({ type: 'no_operations' });
      toast({
        title: "Błąd walidacji",
        description: "Dokument musi zawierać co najmniej jedną operację",
        variant: "destructive"
      });
      setValidationErrors(errors);
      return;
    }

    // Check if inline forms have unsaved data
    if (hasInlineFormData) {
      errors.push({ type: 'inline_form' });
      toast({
        title: "Błąd walidacji",
        description: "Masz wprowadzone dane w formularzu operacji głównych. Dokończ dodawanie operacji lub wyczyść formularz przed zapisem.",
        variant: "destructive"
      });
      setValidationErrors(errors);
      return;
    }

    if (hasParallelInlineFormData) {
      errors.push({ type: 'parallel_inline_form' });
      toast({
        title: "Błąd walidacji",
        description: "Masz wprowadzone dane w formularzu operacji równoległych. Dokończ dodawanie operacji lub wyczyść formularz przed zapisem.",
        variant: "destructive"
      });
      setValidationErrors(errors);
      return;
    }

    // Check for incomplete existing transactions (have some data but missing required fields)
    transactions.forEach((transaction, index) => {
      const hasDescription = transaction.description && transaction.description.trim() !== '';
      const hasDebitAmount = transaction.debit_amount > 0;
      const hasCreditAmount = transaction.credit_amount > 0;
      const hasAnyAmount = hasDebitAmount || hasCreditAmount;
      const hasDebitAccount = !!transaction.debit_account_id;
      const hasCreditAccount = !!transaction.credit_account_id;
      
      // Transaction is incomplete if it has any data but missing required fields
      if (hasDescription || hasAnyAmount || hasDebitAccount || hasCreditAccount) {
        const missingFields: ValidationError['missingFields'] = {};
        
        if (!hasDescription) missingFields.description = true;
        if (!hasDebitAmount && !hasCreditAmount) {
          missingFields.debit_amount = true;
          missingFields.credit_amount = true;
        }
        if (!hasDebitAccount) missingFields.debit_account_id = true;
        if (!hasCreditAccount) missingFields.credit_account_id = true;
        
        if (Object.keys(missingFields).length > 0) {
          errors.push({ 
            type: 'incomplete_transaction', 
            transactionIndex: index, 
            isParallel: false,
            missingFields 
          });
        }
      }
    });

    parallelTransactions.forEach((transaction, index) => {
      const hasDescription = transaction.description && transaction.description.trim() !== '';
      const hasDebitAmount = transaction.debit_amount > 0;
      const hasCreditAmount = transaction.credit_amount > 0;
      const hasAnyAmount = hasDebitAmount || hasCreditAmount;
      const hasDebitAccount = !!transaction.debit_account_id;
      const hasCreditAccount = !!transaction.credit_account_id;
      
      // Transaction is incomplete if it has any data but missing required fields
      if (hasDescription || hasAnyAmount || hasDebitAccount || hasCreditAccount) {
        const missingFields: ValidationError['missingFields'] = {};
        
        if (!hasDescription) missingFields.description = true;
        if (!hasDebitAmount && !hasCreditAmount) {
          missingFields.debit_amount = true;
          missingFields.credit_amount = true;
        }
        if (!hasDebitAccount) missingFields.debit_account_id = true;
        if (!hasCreditAccount) missingFields.credit_account_id = true;
        
        if (Object.keys(missingFields).length > 0) {
          errors.push({ 
            type: 'incomplete_transaction', 
            transactionIndex: index, 
            isParallel: true,
            missingFields 
          });
        }
      }
    });

    if (errors.length > 0) {
      toast({
        title: "Błąd walidacji",
        description: `Istnieją ${errors.filter(e => e.type === 'incomplete_transaction').length} niekompletne operacje z wprowadzonymi danymi. Uzupełnij wszystkie pola lub usuń niekompletne operacje.`,
        variant: "destructive"
      });
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);

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
          // First pass: insert transactions without parents
          const parentsToInsert = allTransactionsSafe
            .filter(t => !t.parent_transaction_id)
            .map(t => ({
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
              document_number: data.document_number,
              parent_transaction_id: null
            }));

          const { data: insertedParents, error: parentError } = await supabase
            .from('transactions')
            .insert(parentsToInsert)
            .select();
          
          if (parentError) {
            console.error('Error inserting parent transactions:', parentError);
            throw parentError;
          }

          // Create mapping from old temp IDs to new DB IDs
          const idMap = new Map<string, string>();
          let parentIndex = 0;
          allTransactionsSafe.forEach(t => {
            if (!t.parent_transaction_id && insertedParents && insertedParents[parentIndex]) {
              if (t.id) {
                idMap.set(t.id, insertedParents[parentIndex].id);
              }
              parentIndex++;
            }
          });

          // Second pass: insert child transactions with correct parent_transaction_id
          const childrenToInsert = allTransactionsSafe
            .filter(t => t.parent_transaction_id)
            .map(t => ({
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
              document_number: data.document_number,
              parent_transaction_id: idMap.get(t.parent_transaction_id) || null
            }));

          if (childrenToInsert.length > 0) {
            const { error: childrenError } = await supabase
              .from('transactions')
              .insert(childrenToInsert);
            
            if (childrenError) {
              console.error('Error inserting child transactions:', childrenError);
              throw childrenError;
            }
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
    // Clear validation errors when a new transaction is added
    setValidationErrors([]);
  };

  const addParallelTransaction = async (transaction: Transaction) => {
    const currency = form.getValues('currency');
    const transactionWithCurrency = {
      ...transaction,
      currency
    };
    setParallelTransactions(prev => [...prev, transactionWithCurrency]);
    // Clear validation errors when a new transaction is added
    setValidationErrors([]);
  };

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
    // Clear validation errors when a transaction is removed
    setValidationErrors([]);
  };

  const removeParallelTransaction = (index: number) => {
    setParallelTransactions(prev => prev.filter((_, i) => i !== index));
    // Clear validation errors when a transaction is removed
    setValidationErrors([]);
  };

  const handleUpdateTransaction = (index: number, updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map((t, i) => i === index ? updatedTransaction : t));
    // Clear validation errors when a transaction is updated
    setValidationErrors(prev => prev.filter(e => !(e.type === 'incomplete_transaction' && e.transactionIndex === index && e.isParallel === false)));
  };

  const handleUpdateParallelTransaction = (index: number, updatedTransaction: Transaction) => {
    setParallelTransactions(prev => prev.map((t, i) => i === index ? updatedTransaction : t));
    // Clear validation errors when a transaction is updated
    setValidationErrors(prev => prev.filter(e => !(e.type === 'incomplete_transaction' && e.transactionIndex === index && e.isParallel === true)));
  };

  const handleSelectTransaction = (index: number, checked: boolean) => {
    setSelectedTransactions(prev => 
      checked 
        ? [...prev, index]
        : prev.filter(i => i !== index)
    );
  };

  const handleSelectParallelTransaction = (index: number, checked: boolean) => {
    setSelectedParallelTransactions(prev => 
      checked 
        ? [...prev, index]
        : prev.filter(i => i !== index)
    );
  };

  const handleCopyTransaction = (transaction: Transaction, isParallel: boolean = false) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: undefined,
      isCloned: true,
      clonedType: transaction.credit_account_id ? 'credit' : 'debit'
    };
    if (isParallel) {
      setParallelTransactions(prev => [...prev, newTransaction]);
    } else {
      setTransactions(prev => [...prev, newTransaction]);
    }
    toast({
      title: "Transakcja skopiowana",
      description: "Transakcja została dodana do listy",
    });
  };

  const handleSplitTransaction = (transaction: Transaction, isParallel: boolean = false) => {
    const debitAmount = transaction.debit_amount || 0;
    const creditAmount = transaction.credit_amount || 0;
    
    if (debitAmount === 0 && creditAmount === 0) {
      toast({
        title: "Błąd",
        description: "Brak kwot do rozdzielenia",
        variant: "destructive"
      });
      return;
    }

    // Check if this is already a split transaction (one field is empty)
    const isAlreadySplit = (debitAmount === 0 && creditAmount > 0) || (creditAmount === 0 && debitAmount > 0);

    if (isAlreadySplit) {
      // If already split, calculate total debit and credit sums from all transactions
      const allTransactions = [...transactions, ...parallelTransactions];
      
      const totalDebit = allTransactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0);
      const totalCredit = allTransactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0);

      // Determine which side has smaller sum
      const isDebitSideSmaller = totalDebit < totalCredit;
      const balanceAmount = Math.abs(totalDebit - totalCredit);

      if (balanceAmount === 0) {
        toast({
          title: "Błąd",
          description: "Sumy Wn i Ma są już wyrównane",
          variant: "destructive"
        });
        return;
      }

      // Create transaction with the same empty field as original
      // Fill the side with smaller total sum with the balancing amount
      const newTransaction: Transaction = {
        ...transaction,
        id: undefined,
        description: transaction.description,
        debit_amount: isDebitSideSmaller ? balanceAmount : undefined,
        credit_amount: isDebitSideSmaller ? undefined : balanceAmount,
        amount: balanceAmount,
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        parent_transaction_id: transaction.id,
      };

      if (isParallel) {
        const parentIndex = parallelTransactions.findIndex(t => t.id === transaction.id);
        setParallelTransactions(prev => {
          const updated = [...prev];
          updated.splice(parentIndex + 1, 0, newTransaction);
          return updated;
        });
      } else {
        const parentIndex = transactions.findIndex(t => t.id === transaction.id);
        setTransactions(prev => {
          const updated = [...prev];
          updated.splice(parentIndex + 1, 0, newTransaction);
          return updated;
        });
      }

      toast({
        title: "Kwota wyrównana",
        description: `Utworzono operację wyrównującą: ${balanceAmount.toFixed(2)} ${form.getValues('currency')}`,
      });
    } else {
      // Normal split: both fields have values
      const isDebitSmaller = debitAmount < creditAmount;
      const difference = Math.abs(debitAmount - creditAmount);

      if (difference === 0) {
        toast({
          title: "Błąd",
          description: "Kwoty są równe, nie ma czego rozdzielać",
          variant: "destructive"
        });
        return;
      }

      // Create new transaction:
      // - Field with LARGER amount should be EMPTY (undefined)
      // - Field with SMALLER amount should have the difference (larger - smaller)
      const newTransaction: Transaction = {
        ...transaction,
        id: undefined,
        description: transaction.description,
        debit_amount: isDebitSmaller ? difference : undefined,
        credit_amount: isDebitSmaller ? undefined : difference,
        amount: difference,
        debit_account_id: transaction.debit_account_id || '',
        credit_account_id: transaction.credit_account_id || '',
        parent_transaction_id: transaction.id,
      };

      if (isParallel) {
        const parentIndex = parallelTransactions.findIndex(t => t.id === transaction.id);
        setParallelTransactions(prev => {
          const updated = [...prev];
          updated.splice(parentIndex + 1, 0, newTransaction);
          return updated;
        });
      } else {
        const parentIndex = transactions.findIndex(t => t.id === transaction.id);
        setTransactions(prev => {
          const updated = [...prev];
          updated.splice(parentIndex + 1, 0, newTransaction);
          return updated;
        });
      }

      toast({
        title: "Kwota rozdzielona",
        description: `Utworzono operację z kwotą: ${difference.toFixed(2)} ${form.getValues('currency')}`,
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTransactions(checked ? transactions.map((_, index) => index) : []);
  };

  const handleSelectAllParallel = (checked: boolean) => {
    setSelectedParallelTransactions(checked ? parallelTransactions.map((_, index) => index) : []);
  };

  const handleCopySelected = () => {
    const selectedTrans = selectedTransactions.map(index => transactions[index]);
    const copiedTransactions = selectedTrans.map(transaction => ({
      ...transaction,
      debit_account_id: '',
      credit_account_id: '',
    }));
    
    setTransactions(prev => [...prev, ...copiedTransactions]);
    setSelectedTransactions([]);
    
    toast({
      title: "Sukces",
      description: `Skopiowano ${copiedTransactions.length} operacji`
    });
  };

  const handleParallelPosting = () => {
    const selectedTrans = selectedTransactions.map(index => transactions[index]);
    // FIX: Nie zamieniamy stron - kopiujemy kwoty do odpowiednich miejsc
    const parallelTransactionsCopy = selectedTrans.map(transaction => ({
      ...transaction,
      // Zachowujemy strony - Wn → Wn, Ma → Ma
      debit_account_id: '',  // Konto zostawiamy puste do wypełnienia
      credit_account_id: '', // Konto zostawiamy puste do wypełnienia
      debit_amount: transaction.debit_amount,   // Wn → Wn
      credit_amount: transaction.credit_amount, // Ma → Ma
    }));
    
    setParallelTransactions(prev => [...prev, ...parallelTransactionsCopy]);
    setSelectedTransactions([]);
    
    toast({
      title: "Sukces", 
      description: `Utworzono ${parallelTransactionsCopy.length} operacji równoległych`
    });
  };

  const getCurrencySymbol = (currency: string = 'PLN') => {
    const currencySymbols: { [key: string]: string } = {
      'PLN': 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr',
      'SEK': 'kr',
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

  const mainDebitSum = transactions.reduce((sum, transaction) => {
    const debitAmount = transaction.debit_amount !== undefined ? transaction.debit_amount : 0;
    return sum + (debitAmount || 0);
  }, 0);

  const mainCreditSum = transactions.reduce((sum, transaction) => {
    const creditAmount = transaction.credit_amount !== undefined ? transaction.credit_amount : 0;
    return sum + (creditAmount || 0);
  }, 0);

  const parallelDebitSum = parallelTransactions.reduce((sum, transaction) => {
    const debitAmount = transaction.debit_amount !== undefined ? transaction.debit_amount : 0;
    return sum + (debitAmount || 0);
  }, 0);

  const parallelCreditSum = parallelTransactions.reduce((sum, transaction) => {
    const creditAmount = transaction.credit_amount !== undefined ? transaction.credit_amount : 0;
    return sum + (creditAmount || 0);
  }, 0);

  const totalDebitSum = mainDebitSum + parallelDebitSum;
  const totalCreditSum = mainCreditSum + parallelCreditSum;
  const grandTotalSum = totalDebitSum + totalCreditSum;

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
                {selectedTransactions.length > 0 && (
                  <>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCopySelected} 
                      className="flex items-center gap-2"
                      disabled={isEditingBlocked}
                    >
                      <Copy className="h-4 w-4" />
                      Kopiuj ({selectedTransactions.length})
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleParallelPosting} 
                      className="flex items-center gap-2"
                      disabled={isEditingBlocked}
                    >
                      <BookOpen className="h-4 w-4" />
                      Księgowanie równoległe ({selectedTransactions.length})
                    </Button>
                  </>
                )}
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
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedTransactions.length === transactions.length && transactions.length > 0}
                            onCheckedChange={handleSelectAll}
                            disabled={isEditingBlocked || transactions.length === 0}
                          />
                        </TableHead>
                        <TableHead>Opis</TableHead>
                        <TableHead className="text-right">Kwota Winien</TableHead>
                        <TableHead>Konto Winien</TableHead>
                        <TableHead className="text-right">Kwota Ma</TableHead>
                        <TableHead>Konto Ma</TableHead>
                        <TableHead>Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                  {React.useMemo(() => {
                    const mainTransactions = transactions.filter(t => !t.parent_transaction_id);
                    return mainTransactions.map((mainTx, mainIndex) => {
                      const subTransactions = transactions.filter(t => t.parent_transaction_id === mainTx.id);
                      const actualMainIndex = transactions.indexOf(mainTx);
                      const errorInfo = validationErrors.find(
                        e => e.type === 'incomplete_transaction' && 
                        e.transactionIndex === actualMainIndex && 
                        e.isParallel === false
                      );
                      
                      return (
                        <React.Fragment key={mainTx.id || mainIndex}>
                          <EditableTransactionRow
                            transaction={mainTx}
                            onUpdate={(updatedTransaction) => handleUpdateTransaction(actualMainIndex, updatedTransaction)}
                            onDelete={() => removeTransaction(actualMainIndex)}
                            onCopy={() => handleCopyTransaction(mainTx, false)}
                            onSplit={() => handleSplitTransaction(mainTx, false)}
                            currency={selectedCurrency}
                            isEditingBlocked={isEditingBlocked}
                            isSelected={selectedTransactions.includes(actualMainIndex)}
                            onSelect={(checked) => handleSelectTransaction(actualMainIndex, checked)}
                            hasValidationError={!!errorInfo}
                            missingFields={errorInfo?.missingFields}
                          />
                          {subTransactions.map((subTx, subIndex) => {
                            const actualSubIndex = transactions.indexOf(subTx);
                            const subErrorInfo = validationErrors.find(
                              e => e.type === 'incomplete_transaction' && 
                              e.transactionIndex === actualSubIndex && 
                              e.isParallel === false
                            );
                            return (
                              <EditableTransactionRow
                                key={`${mainTx.id}-sub-${subIndex}`}
                                transaction={subTx}
                                onUpdate={(updatedTransaction) => handleUpdateTransaction(actualSubIndex, updatedTransaction)}
                                onDelete={() => removeTransaction(actualSubIndex)}
                                onCopy={() => handleCopyTransaction(subTx, false)}
                                onSplit={() => handleSplitTransaction(subTx, false)}
                                currency={selectedCurrency}
                                isEditingBlocked={isEditingBlocked}
                                isSelected={selectedTransactions.includes(actualSubIndex)}
                                onSelect={(checked) => handleSelectTransaction(actualSubIndex, checked)}
                                hasValidationError={!!subErrorInfo}
                                missingFields={subErrorInfo?.missingFields}
                                isSubTransaction={true}
                              />
                            );
                          })}
                        </React.Fragment>
                      );
                    });
                  }, [transactions, validationErrors, selectedTransactions, selectedCurrency, isEditingBlocked])}
                    {showInlineForm && (
                      <InlineTransactionRow
                        onSave={addTransaction}
                        isEditingBlocked={isEditingBlocked}
                        currency={selectedCurrency}
                        onHasDataChange={setHasInlineFormData}
                        hasValidationError={validationErrors.some(e => e.type === 'inline_form')}
                      />
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-gray-50 font-medium">
                      <TableCell colSpan={3} className="text-right font-bold">
                        RAZEM:
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatAmount(mainDebitSum, selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatAmount(mainCreditSum, selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-left font-bold">
                        Suma: {formatAmount(mainDebitSum + mainCreditSum, selectedCurrency)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowParallelAccounting(!showParallelAccounting)}
              className="flex items-center gap-2"
              disabled={isEditingBlocked}
            >
              <BookOpen className="h-4 w-4" />
              {showParallelAccounting ? 'Ukryj księgowanie równoległe' : 'Pokaż księgowanie równoległe'}
            </Button>
          </div>

          {showParallelAccounting && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Księgowanie równoległe</h3>
                <div className="flex gap-2">
                  {selectedParallelTransactions.length > 0 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        const selectedTrans = selectedParallelTransactions.map(index => parallelTransactions[index]);
                        const copiedTransactions = selectedTrans.map(transaction => ({
                          ...transaction,
                          debit_account_id: '',
                          credit_account_id: '',
                        }));
                        
                        setParallelTransactions(prev => [...prev, ...copiedTransactions]);
                        setSelectedParallelTransactions([]);
                        
                        toast({
                          title: "Sukces",
                          description: `Skopiowano ${copiedTransactions.length} operacji równoległych`
                        });
                      }} 
                      className="flex items-center gap-2"
                      disabled={isEditingBlocked}
                    >
                      <Copy className="h-4 w-4" />
                      Kopiuj ({selectedParallelTransactions.length})
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setShowParallelInlineForm(true)} className="flex items-center gap-2" disabled={isEditingBlocked}>
                    <Plus className="h-4 w-4" />
                    Dodaj operację równoległą
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedParallelTransactions.length === parallelTransactions.length && parallelTransactions.length > 0}
                              onCheckedChange={handleSelectAllParallel}
                              disabled={isEditingBlocked || parallelTransactions.length === 0}
                            />
                          </TableHead>
                          <TableHead>Opis</TableHead>
                          <TableHead>Konto Wn</TableHead>
                          <TableHead className="text-right">Winien</TableHead>
                          <TableHead>Konto Ma</TableHead>
                          <TableHead className="text-right">Ma</TableHead>
                          <TableHead>Akcje</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                    {React.useMemo(() => {
                      const mainTransactions = parallelTransactions.filter(t => !t.parent_transaction_id);
                      return mainTransactions.map((mainTx, mainIndex) => {
                        const subTransactions = parallelTransactions.filter(t => t.parent_transaction_id === mainTx.id);
                        const actualMainIndex = parallelTransactions.indexOf(mainTx);
                        const errorInfo = validationErrors.find(
                          e => e.type === 'incomplete_transaction' && 
                          e.transactionIndex === actualMainIndex && 
                          e.isParallel === true
                        );
                        
                        return (
                          <React.Fragment key={mainTx.id || mainIndex}>
                            <EditableTransactionRow
                              transaction={mainTx}
                              onUpdate={(updatedTransaction) => handleUpdateParallelTransaction(actualMainIndex, updatedTransaction)}
                              onDelete={() => removeParallelTransaction(actualMainIndex)}
                              onCopy={() => handleCopyTransaction(mainTx, true)}
                              onSplit={() => handleSplitTransaction(mainTx, true)}
                              currency={selectedCurrency}
                              isEditingBlocked={isEditingBlocked}
                              isSelected={selectedParallelTransactions.includes(actualMainIndex)}
                              onSelect={(checked) => handleSelectParallelTransaction(actualMainIndex, checked)}
                              hasValidationError={!!errorInfo}
                              missingFields={errorInfo?.missingFields}
                            />
                            {subTransactions.map((subTx, subIndex) => {
                              const actualSubIndex = parallelTransactions.indexOf(subTx);
                              const subErrorInfo = validationErrors.find(
                                e => e.type === 'incomplete_transaction' && 
                                e.transactionIndex === actualSubIndex && 
                                e.isParallel === true
                              );
                              return (
                                <EditableTransactionRow
                                  key={`${mainTx.id}-sub-${subIndex}`}
                                  transaction={subTx}
                                  onUpdate={(updatedTransaction) => handleUpdateParallelTransaction(actualSubIndex, updatedTransaction)}
                                  onDelete={() => removeParallelTransaction(actualSubIndex)}
                                  onCopy={() => handleCopyTransaction(subTx, true)}
                                  onSplit={() => handleSplitTransaction(subTx, true)}
                                  currency={selectedCurrency}
                                  isEditingBlocked={isEditingBlocked}
                                  isSelected={selectedParallelTransactions.includes(actualSubIndex)}
                                  onSelect={(checked) => handleSelectParallelTransaction(actualSubIndex, checked)}
                                  hasValidationError={!!subErrorInfo}
                                  missingFields={subErrorInfo?.missingFields}
                                  isSubTransaction={true}
                                />
                              );
                            })}
                          </React.Fragment>
                        );
                      });
                    }, [parallelTransactions, validationErrors, selectedParallelTransactions, selectedCurrency, isEditingBlocked])}
                      {showParallelInlineForm && (
                        <InlineTransactionRow
                          onSave={addParallelTransaction}
                          isEditingBlocked={isEditingBlocked}
                          currency={selectedCurrency}
                          onHasDataChange={setHasParallelInlineFormData}
                          hasValidationError={validationErrors.some(e => e.type === 'parallel_inline_form')}
                        />
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-gray-50 font-medium">
                        <TableCell colSpan={3} className="text-right font-bold">
                          RAZEM:
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatAmount(parallelDebitSum, selectedCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatAmount(parallelCreditSum, selectedCurrency)}
                        </TableCell>
                        <TableCell className="text-left font-bold">
                          Suma: {formatAmount(parallelDebitSum + parallelCreditSum, selectedCurrency)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-bold text-lg mb-2">Podsumowanie dokumentu</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600">Winien razem</div>
                  <div className="font-bold text-lg">{formatAmount(totalDebitSum, selectedCurrency)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Ma razem</div>
                  <div className="font-bold text-lg">{formatAmount(totalCreditSum, selectedCurrency)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Suma całkowita</div>
                  <div className="font-bold text-lg">{formatAmount(grandTotalSum, selectedCurrency)}</div>
                </div>
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

const EditableTransactionRow: React.FC<{
  transaction: Transaction;
  onUpdate: (transaction: Transaction) => void;
  onDelete: () => void;
  onCopy?: () => void;
  onSplit?: () => void;
  currency: string;
  isEditingBlocked?: boolean;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
  hasValidationError?: boolean;
  missingFields?: ValidationError['missingFields'];
  isSubTransaction?: boolean;
  className?: string;
}> = ({ transaction, onUpdate, onDelete, onCopy, onSplit, currency, isEditingBlocked = false, isSelected = false, onSelect, hasValidationError = false, missingFields, isSubTransaction = false, className }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    description: transaction.description || '',
    debit_account_id: transaction.debit_account_id || '',
    credit_account_id: transaction.credit_account_id || '',
    debit_amount: transaction.debit_amount || 0,
    credit_amount: transaction.credit_amount || 0,
  });

  // Determine if this is a split transaction with one side empty
  const isDebitEmpty = !formData.debit_amount || formData.debit_amount === 0;
  const isCreditEmpty = !formData.credit_amount || formData.credit_amount === 0;
  const isSplitTransaction = (isDebitEmpty && !isCreditEmpty) || (isCreditEmpty && !isDebitEmpty);
  const isDebitReadOnly = isSplitTransaction && isDebitEmpty;
  const isCreditReadOnly = isSplitTransaction && isCreditEmpty;

  useEffect(() => {
    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(formData.debit_amount, formData.credit_amount),
      currency: currency,
    };
    onUpdate(updatedTransaction);
  }, [formData, currency]);

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

  const getCurrencySymbol = (currency: string = 'PLN') => {
    const currencySymbols: { [key: string]: string } = {
      'PLN': 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr',
      'SEK': 'kr',
    };
    return currencySymbols[currency] || currency;
  };

  return (
    <TableRow className={cn(
      hasValidationError ? "bg-destructive/10 border-2 border-destructive" : 
      isSelected ? "bg-blue-100 border-l-4 border-l-blue-500" : 
      isSubTransaction ? "bg-blue-50/50 hover:bg-blue-100/50" :
      "hover:bg-gray-50",
      className
    )}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell className={cn(isSubTransaction && "pl-8")}>
        <Textarea 
          value={formData.description} 
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} 
          placeholder="Opis operacji..." 
          className={cn(
            "min-h-[60px] resize-none",
            missingFields?.description && "border-destructive focus-visible:ring-destructive bg-destructive/5"
          )}
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Input 
            type="number" 
            step="0.01" 
            min="0" 
            value={formData.debit_amount || ''} 
            onChange={e => {
              const value = parseFloat(e.target.value) || 0;
              setFormData(prev => ({ ...prev, debit_amount: value }));
            }}
            placeholder="0.00" 
            className={cn(
              "text-right", 
              isDebitReadOnly && "bg-muted text-muted-foreground cursor-not-allowed",
              missingFields?.debit_amount && "border-destructive focus-visible:ring-destructive bg-destructive/5"
            )}
            disabled={isEditingBlocked || isDebitReadOnly}
            readOnly={isDebitReadOnly}
          />
          <span className="text-sm text-gray-500">{getCurrencySymbol(currency)}</span>
        </div>
      </TableCell>
      <TableCell>
        <AccountCombobox 
          value={formData.debit_account_id} 
          onChange={accountId => setFormData(prev => ({ ...prev, debit_account_id: accountId }))}
          locationId={userProfile?.location_id}
          side="debit"
          disabled={isEditingBlocked || isDebitReadOnly}
          className={cn(
            isDebitReadOnly && "opacity-50",
            missingFields?.debit_account_id && "border-destructive bg-destructive/5"
          )}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Input 
            type="number" 
            step="0.01" 
            min="0" 
            value={formData.credit_amount || ''} 
            onChange={e => {
              const value = parseFloat(e.target.value) || 0;
              setFormData(prev => ({ ...prev, credit_amount: value }));
            }}
            placeholder="0.00" 
            className={cn(
              "text-right", 
              isCreditReadOnly && "bg-muted text-muted-foreground cursor-not-allowed",
              missingFields?.credit_amount && "border-destructive focus-visible:ring-destructive bg-destructive/5"
            )}
            disabled={isEditingBlocked || isCreditReadOnly}
            readOnly={isCreditReadOnly}
          />
          <span className="text-sm text-gray-500">{getCurrencySymbol(currency)}</span>
        </div>
      </TableCell>
      <TableCell>
        <AccountCombobox 
          value={formData.credit_account_id} 
          onChange={accountId => setFormData(prev => ({ ...prev, credit_account_id: accountId }))}
          locationId={userProfile?.location_id}
          side="credit"
          disabled={isEditingBlocked || isCreditReadOnly}
          className={cn(
            isCreditReadOnly && "opacity-50",
            missingFields?.credit_account_id && "border-destructive bg-destructive/5"
          )}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {onCopy && (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={onCopy}
              title="Kopiuj"
              disabled={isEditingBlocked}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {onSplit && (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={onSplit}
              title="Rozdziel kwotę"
              disabled={isEditingBlocked}
            >
              <Split className="h-4 w-4" />
            </Button>
          )}
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={onDelete} 
            className="text-red-600 hover:text-red-700"
            title="Usuń"
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