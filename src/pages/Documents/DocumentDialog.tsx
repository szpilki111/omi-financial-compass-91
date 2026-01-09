import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Trash2, RefreshCw, Copy, BookOpen, Split, GripVertical, FileSpreadsheet, Bug } from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { ErrorReportDialog } from "@/components/ErrorReportDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import ConfirmCloseDialog from "./ConfirmCloseDialog";
import InlineTransactionRow, { InlineTransactionRowRef } from "./InlineTransactionRow";
import PrintableDocument from "@/components/PrintableDocument";
import { AccountCombobox } from "./AccountCombobox";
import { Transaction } from "./types";
import CurrencySelector from "@/components/CurrencySelector";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: () => void;
  document?: any;
}

interface ValidationError {
  type: "inline_form" | "parallel_inline_form" | "incomplete_transaction" | "no_operations";
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

const DocumentDialog = ({ isOpen, onClose, onDocumentCreated, document }: DocumentDialogProps) => {
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
  const [errorReportDialogOpen, setErrorReportDialogOpen] = useState(false);
  const [errorScreenshot, setErrorScreenshot] = useState<string | null>(null);
  const [isCapturingError, setIsCapturingError] = useState(false);
  const inlineFormRef = useRef<InlineTransactionRowRef>(null);
  const parallelInlineFormRef = useRef<InlineTransactionRowRef>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const form = useForm<DocumentFormData>({
    defaultValues: {
      document_number: "",
      document_name: "",
      document_date: new Date(),
      currency: "PLN",
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("location_id").eq("id", user?.id).single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: locationSettings } = useQuery({
    queryKey: ["locationSettings", userProfile?.location_id],
    queryFn: async () => {
      if (!userProfile?.location_id) return null;
      const { data, error } = await supabase
        .from("location_settings")
        .select("allow_foreign_currencies")
        .eq("location_id", userProfile.location_id)
        .single();
      if (error) return { allow_foreign_currencies: false };
      return data;
    },
    enabled: !!userProfile?.location_id,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, number, name")
        .order("number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const documentDate = form.watch("document_date");
  const { data: isEditingBlocked, isLoading: checkingBlock } = useQuery({
    queryKey: ["editingBlocked", document?.id, userProfile?.location_id, documentDate],
    queryFn: async () => {
      if (!userProfile?.location_id || !documentDate) return false;
      const { data, error } = await supabase.rpc("check_report_editing_blocked", {
        p_location_id: userProfile.location_id,
        p_document_date: format(documentDate, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.location_id && !!documentDate && isOpen,
  });

  const handleExportToExcel = () => {
    const formData = form.getValues();
    
    // Połącz transakcje główne i równoległe
    const allTransactions = [...transactions, ...parallelTransactions].filter(t => 
      (t.debit_amount && t.debit_amount > 0) || (t.credit_amount && t.credit_amount > 0)
    );

    // Funkcja pomocnicza do pobierania numeru konta - użyj danych z transakcji lub lookup w accounts
    const getDebitAccountNumber = (t: Transaction) => {
      return t.debitAccountNumber || t.debitAccount?.number || accounts?.find(a => a.id === t.debit_account_id)?.number || '';
    };
    
    const getCreditAccountNumber = (t: Transaction) => {
      return t.creditAccountNumber || t.creditAccount?.number || accounts?.find(a => a.id === t.credit_account_id)?.number || '';
    };

    // Sumy
    const totalDebit = allTransactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0);
    const totalCredit = allTransactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0);

    // Buduj dane arkusza
    const wsData: (string | number | undefined)[][] = [];
    
    // Nagłówek dokumentu
    wsData.push([`POLECENIE KSIĘGOWANIA nr ${formData.document_number}`]);
    wsData.push([formData.document_name]);
    wsData.push([]);
    wsData.push([
      `Data dokumentu: ${format(formData.document_date, 'dd.MM.yyyy')}`,
      '',
      `Data operacji: ${format(formData.document_date, 'dd.MM.yyyy')}`
    ]);
    wsData.push([
      `Okres: ${format(formData.document_date, 'MM/yyyy')}`,
      '',
      `Waluta: ${formData.currency}`
    ]);
    wsData.push([]);
    
    // Nagłówki tabeli transakcji
    wsData.push(['Lp', 'Treść zapisu', 'Kwota Wn', 'Konto Wn', 'Kwota Ma', 'Konto Ma']);
    
    // Transakcje
    allTransactions.forEach((t, idx) => {
      wsData.push([
        idx + 1,
        t.description || '-',
        t.debit_amount || '',
        getDebitAccountNumber(t),
        t.credit_amount || '',
        getCreditAccountNumber(t)
      ]);
    });
    
    // Wiersz podsumowania
    wsData.push(['', 'Razem:', totalDebit, '', totalCredit, '']);

    // Utwórz arkusz i skoroszyt
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Ustaw szerokości kolumn
    ws['!cols'] = [
      { wch: 5 },   // Lp
      { wch: 40 },  // Treść zapisu
      { wch: 15 },  // Kwota Wn
      { wch: 15 },  // Konto Wn
      { wch: 15 },  // Kwota Ma
      { wch: 15 }   // Konto Ma
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dokument');
    
    // Eksportuj plik
    const fileName = `${formData.document_number.replace(/\//g, '-')}_${format(formData.document_date, 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: 'Eksport zakończony',
      description: `Plik ${fileName} został pobrany`,
    });
  };

  const captureErrorScreenshot = async () => {
    setIsCapturingError(true);
    try {
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      setErrorScreenshot(dataUrl);
      setErrorReportDialogOpen(true);
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zrobić screenshota, ale możesz zgłosić błąd bez niego.",
        variant: "destructive",
      });
      setErrorScreenshot(null);
      setErrorReportDialogOpen(true);
    } finally {
      setIsCapturingError(false);
    }
  };

  const getBrowserInfo = () => {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  };

  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // NOTE: Removed useEffect that set hasUnsavedChanges on transactions change,
  // as it caused false "unsaved changes" alerts when loading existing documents.
  // hasUnsavedChanges is now tracked only by form.watch() and explicit user edits.

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
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isOpen]);

  const checkLastTransactionComplete = () => {
    const errors: ValidationError[] = [];

    // Check if inline form has unsaved data
    if (hasInlineFormData) {
      errors.push({ type: "inline_form" });
      toast({
        title: "Błąd walidacji",
        description:
          "Masz wprowadzone dane w formularzu operacji głównych. Dokończ dodawanie operacji lub wyczyść formularz przed zamknięciem.",
        variant: "destructive",
      });
      setValidationErrors(errors);
      return false;
    }

    // Check if parallel inline form has unsaved data
    if (hasParallelInlineFormData) {
      errors.push({ type: "parallel_inline_form" });
      toast({
        title: "Błąd walidacji",
        description:
          "Masz wprowadzone dane w formularzu operacji równoległych. Dokończ dodawanie operacji lub wyczyść formularz przed zamknięciem.",
        variant: "destructive",
      });
      setValidationErrors(errors);
      return false;
    }

    // Check for incomplete existing transactions
    transactions.forEach((transaction, index) => {
      const hasDescription = transaction.description && transaction.description.trim() !== "";
      const hasDebitAmount = transaction.debit_amount > 0;
      const hasCreditAmount = transaction.credit_amount > 0;
      const hasAnyAmount = hasDebitAmount || hasCreditAmount;
      const hasDebitAccount = !!transaction.debit_account_id;
      const hasCreditAccount = !!transaction.credit_account_id;

      // Transaction is incomplete if it has any data but missing required fields
      if (hasDescription || hasAnyAmount || hasDebitAccount || hasCreditAccount) {
        const missingFields: ValidationError["missingFields"] = {};

        if (!hasDescription) missingFields.description = true;
        if (!hasDebitAmount && !hasCreditAmount) {
          missingFields.debit_amount = true;
          missingFields.credit_amount = true;
        }
        if (!hasDebitAccount) missingFields.debit_account_id = true;
        if (!hasCreditAccount) missingFields.credit_account_id = true;

        if (Object.keys(missingFields).length > 0) {
          errors.push({
            type: "incomplete_transaction",
            transactionIndex: index,
            isParallel: false,
            missingFields,
          });
        }
      }
    });

    parallelTransactions.forEach((transaction, index) => {
      const hasDescription = transaction.description && transaction.description.trim() !== "";
      const hasDebitAmount = transaction.debit_amount > 0;
      const hasCreditAmount = transaction.credit_amount > 0;
      const hasAnyAmount = hasDebitAmount || hasCreditAmount;
      const hasDebitAccount = !!transaction.debit_account_id;
      const hasCreditAccount = !!transaction.credit_account_id;

      // Transaction is incomplete if it has any data but missing required fields
      if (hasDescription || hasAnyAmount || hasDebitAccount || hasCreditAccount) {
        const missingFields: ValidationError["missingFields"] = {};

        if (!hasDescription) missingFields.description = true;
        if (!hasDebitAmount && !hasCreditAmount) {
          missingFields.debit_amount = true;
          missingFields.credit_amount = true;
        }
        if (!hasDebitAccount) missingFields.debit_account_id = true;
        if (!hasCreditAccount) missingFields.credit_account_id = true;

        if (Object.keys(missingFields).length > 0) {
          errors.push({
            type: "incomplete_transaction",
            transactionIndex: index,
            isParallel: true,
            missingFields,
          });
        }
      }
    });

    if (errors.length > 0) {
      const incompleteCount = errors.filter((e) => e.type === "incomplete_transaction").length;
      toast({
        title: "Błąd walidacji",
        description: `Istnieją ${incompleteCount} niekompletne operacje z wprowadzonymi danymi. Uzupełnij wszystkie pola lub usuń niekompletne operacje przed zamknięciem.`,
        variant: "destructive",
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
    const currentDate = form.getValues("document_date");
    const generatedNumber = await generateDocumentNumber(currentDate);
    if (generatedNumber) {
      form.setValue("document_number", generatedNumber);
    }
  };

  const generateDocumentNumber = async (date: Date) => {
    if (!user?.location) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji użytkownika",
        variant: "destructive",
      });
      return "";
    }
    setIsGeneratingNumber(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const { data, error } = await supabase.rpc("generate_document_number", {
        p_location_id: user.location,
        p_year: year,
        p_month: month,
      });
      if (error) {
        console.error("Error generating document number:", error);
        throw error;
      }
      return data || "";
    } catch (error: any) {
      console.error("Error generating document number:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się wygenerować numeru dokumentu",
        variant: "destructive",
      });
      return "";
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
        currency: document.currency || "PLN",
      });

      loadTransactions(document.id);
      setHasUnsavedChanges(false);
    } else {
      form.reset({
        document_number: "",
        document_name: "",
        document_date: new Date(),
        currency: "PLN",
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
        if (name === "document_date" && value.document_date) {
          generateDocumentNumber(new Date(value.document_date)).then((generatedNumber) => {
            if (generatedNumber) {
              form.setValue("document_number", generatedNumber);
            }
          });
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [document, isOpen, form]);

  useEffect(() => {
    if (!document && isOpen && user?.location) {
      const currentDate = form.getValues("document_date");
      generateDocumentNumber(currentDate).then((generatedNumber) => {
        if (generatedNumber) {
          form.setValue("document_number", generatedNumber);
        }
      });
    }
  }, [document, isOpen, user?.location]);

  const loadTransactions = async (documentId: string) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          debit_account:accounts!transactions_debit_account_id_fkey(id, number, name),
          credit_account:accounts!transactions_credit_account_id_fkey(id, number, name)
        `)
        .eq("document_id", documentId)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (error) throw error;

      console.log(
        "Loaded transactions from database:",
        data?.map((t) => ({
          id: t.id,
          display_order: t.display_order,
          is_parallel: t.is_parallel,
          description: t.description,
        })),
      );

      // Mapuj transakcje aby dołączyć numery kont
      const mappedTransactions = (data || []).map(t => ({
        ...t,
        debitAccountNumber: t.debit_account?.number || '',
        creditAccountNumber: t.credit_account?.number || '',
        debitAccount: t.debit_account,
        creditAccount: t.credit_account,
      }));

      // Podziel na główne i równoległe
      const mainTransactions = mappedTransactions
        .filter((t) => !t.is_parallel)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const parallelTxs = mappedTransactions
        .filter((t) => t.is_parallel)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

      // Sortuj według display_order z bazy (bez nadpisywania!)
      const sortByDisplayOrder = (txs: any[]) =>
        [...txs].sort((a, b) => {
          const aOrder = a.display_order ?? 0;
          const bOrder = b.display_order ?? 0;
          return aOrder - bOrder;
        });

      const sortedMain = sortByDisplayOrder(mainTransactions);
      const sortedParallel = sortByDisplayOrder(parallelTxs);

      // Użyj tej wersji, jeśli chcesz zachować oryginalne display_order:
      setTransactions(sortedMain);
      setParallelTransactions(sortedParallel);

      console.log("UI order (after sort):", {
        main: sortedMain.map((t) => ({ id: t.id, display_order: t.display_order })),
        parallel: sortedParallel.map((t) => ({ id: t.id, display_order: t.display_order })),
      });
    } catch (error) {
      console.error("Error loading transactions:", error);
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

    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można zapisać dokumentu - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive",
      });
      return;
    }

    const allTransactions = [...transactions, ...parallelTransactions];
    const errors: ValidationError[] = [];

    console.log("💾 Starting document save process");
    console.log("Has inline form data:", hasInlineFormData);
    console.log("Has parallel inline form data:", hasParallelInlineFormData);

    // Collect incomplete transaction data from inline forms
    let inlineTransactionToAdd: Transaction | null = null;
    let parallelInlineTransactionToAdd: Transaction | null = null;

    if (hasInlineFormData && inlineFormRef.current) {
      try {
        console.log("Attempting to get inline form data...");
        inlineTransactionToAdd = inlineFormRef.current.getCurrentData();
        console.log("Inline transaction data:", inlineTransactionToAdd);
        if (inlineTransactionToAdd) {
          inlineTransactionToAdd.display_order = allTransactions.length + 1;
        }
      } catch (error) {
        console.error("Error getting inline form data:", error);
      }
    }

    if (hasParallelInlineFormData && parallelInlineFormRef.current) {
      try {
        console.log("Attempting to get parallel inline form data...");
        parallelInlineTransactionToAdd = parallelInlineFormRef.current.getCurrentData();
        console.log("Parallel transaction data:", parallelInlineTransactionToAdd);
        if (parallelInlineTransactionToAdd) {
          parallelInlineTransactionToAdd.display_order = allTransactions.length + (inlineTransactionToAdd ? 2 : 1);
        }
      } catch (error) {
        console.error("Error getting parallel inline form data:", error);
      }
    }

    // Add incomplete transactions to the list
    const transactionsToValidate = [
      ...allTransactions,
      ...(inlineTransactionToAdd ? [inlineTransactionToAdd] : []),
      ...(parallelInlineTransactionToAdd ? [parallelInlineTransactionToAdd] : []),
    ];

    console.log("Transactions to validate:", transactionsToValidate);

    if (transactionsToValidate.length === 0) {
      toast({
        title: "Uwaga",
        description: "Dokument nie zawiera żadnych operacji. Możesz je dodać później.",
        variant: "default",
      });
    }

    // Function to count missing fields in a transaction - supports negative amounts
    const countMissingFields = (transaction: Transaction) => {
      let count = 0;
      
      // Check if this is a split transaction (one side empty, other filled) - use !== 0 for negative amounts
      const hasDebit = transaction.debit_amount && transaction.debit_amount !== 0;
      const hasCredit = transaction.credit_amount && transaction.credit_amount !== 0;
      const isSplitTransaction = (hasDebit && !hasCredit) || (!hasDebit && hasCredit);
      
      if (!transaction.description || transaction.description.trim() === "") count++;
      
      // For split transactions, only validate the filled side
      if (isSplitTransaction) {
        if (hasDebit && !transaction.debit_account_id) count++;
        if (hasCredit && !transaction.credit_account_id) count++;
      } else {
        // For normal transactions, both sides must be filled - use !== 0 for negative amounts
        if (!transaction.debit_amount || transaction.debit_amount === 0) count++;
        if (!transaction.credit_amount || transaction.credit_amount === 0) count++;
        if (!transaction.debit_account_id) count++;
        if (!transaction.credit_account_id) count++;
      }
      
      return count;
    };

    // Check ALL transactions including inline form data
    transactionsToValidate.forEach((transaction, index) => {
      const missingCount = countMissingFields(transaction);

      if (missingCount > 0) {
        const missingFields: ValidationError["missingFields"] = {};
        
        // Check if this is a split transaction - use !== 0 for negative amounts
        const hasDebit = transaction.debit_amount && transaction.debit_amount !== 0;
        const hasCredit = transaction.credit_amount && transaction.credit_amount !== 0;
        const isSplitTransaction = (hasDebit && !hasCredit) || (!hasDebit && hasCredit);

        if (!transaction.description || transaction.description.trim() === "") missingFields.description = true;
        
        if (isSplitTransaction) {
          // For split transactions, only validate the filled side
          if (hasDebit && !transaction.debit_account_id) missingFields.debit_account_id = true;
          if (hasCredit && !transaction.credit_account_id) missingFields.credit_account_id = true;
        } else {
          // For normal transactions, validate both sides - use === 0 for negative amounts
          if (!transaction.debit_amount || transaction.debit_amount === 0) missingFields.debit_amount = true;
          if (!transaction.credit_amount || transaction.credit_amount === 0) missingFields.credit_amount = true;
          if (!transaction.debit_account_id) missingFields.debit_account_id = true;
          if (!transaction.credit_account_id) missingFields.credit_account_id = true;
        }

        errors.push({
          type: "incomplete_transaction",
          transactionIndex: index,
          isParallel: index >= transactions.length,
          missingFields,
        });
      }
    });

    // Set validation errors but allow saving
    setValidationErrors(errors);

    if (errors.length > 0) {
      const totalMissingFields = errors.reduce((sum, e) => {
        if (e.missingFields) {
          return sum + Object.keys(e.missingFields).length;
        }
        return sum;
      }, 0);

      toast({
        title: "Uwaga - dokument zawiera błędy",
        description: `Zapisuję dokument z ${totalMissingFields} pustymi polami. Uzupełnij je później.`,
        variant: "default",
      });
    }

    // Add incomplete transactions from inline forms to the main list
    const finalTransactions = [...transactions, ...(inlineTransactionToAdd ? [inlineTransactionToAdd] : [])];
    const finalParallelTransactions = [
      ...parallelTransactions,
      ...(parallelInlineTransactionToAdd ? [parallelInlineTransactionToAdd] : []),
    ];

    // Preserve display_order from drag-and-drop, or assign new order for transactions without it
    const allFinalTransactions = [
      ...finalTransactions.map((t) => ({
        ...t,
        is_parallel: false,
        // NIE NADPISUJ display_order – używaj tego z drag & drop!
      })),
      ...finalParallelTransactions.map((t) => ({
        ...t,
        is_parallel: true,
        // NIE NADPISUJ display_order
      })),
    ];

    console.log(
      "💾 ZAPISUJĘ display_order do bazy:",
      allFinalTransactions.map((t) => ({
        id: t.id,
        description: t.description?.substring(0, 30),
        display_order: t.display_order,
        is_parallel: t.is_parallel,
      })),
    );

    // Validate document balance - use Math.abs() to support negative amounts
    const totalDebit = allFinalTransactions.reduce((sum, t) => sum + Math.abs(t.debit_amount || 0), 0);
    const totalCredit = allFinalTransactions.reduce((sum, t) => sum + Math.abs(t.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({
        title: "Dokument niezbalansowany",
        description: `Suma WN (${totalDebit.toFixed(2)}) nie równa się sumie MA (${totalCredit.toFixed(2)}). Dokument nie zostanie zapisany.`,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let documentId = document?.id;
      if (document) {
        const { error } = await supabase
          .from("documents")
          .update({
            document_number: data.document_number,
            document_name: data.document_name,
            document_date: format(data.document_date, "yyyy-MM-dd"),
            currency: data.currency,
            validation_errors: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : null,
          })
          .eq("id", document.id);
        if (error) throw error;
      } else {
        const { data: newDocument, error } = await supabase
          .from("documents")
          .insert({
            document_number: data.document_number,
            document_name: data.document_name,
            document_date: format(data.document_date, "yyyy-MM-dd"),
            location_id: user.location,
            user_id: user.id,
            currency: data.currency,
            validation_errors: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : null,
          })
          .select()
          .single();
        if (error) {
          console.error("Error creating document:", error);
          throw error;
        }
        documentId = newDocument.id;
      }

      const allTransactionsSafe = allFinalTransactions.map((t) => ({
        ...t,
        currency: data.currency,
        description: typeof t.description === "string" && t.description.trim() !== "" ? t.description : "",
      }));

      if (documentId) {
        // Use UPDATE/INSERT/DELETE strategy instead of DELETE+INSERT
        const existingTransactionIds = new Set(allTransactionsSafe.filter((t) => t.id).map((t) => t.id));

        // Get all existing transactions for this document
        const { data: existingTransactions } = await supabase
          .from("transactions")
          .select("id")
          .eq("document_id", documentId);

        // Delete transactions that are no longer in the list
        const transactionsToDelete = (existingTransactions || [])
          .filter((t) => !existingTransactionIds.has(t.id))
          .map((t) => t.id);

        if (transactionsToDelete.length > 0) {
          const { error: deleteError } = await supabase.from("transactions").delete().in("id", transactionsToDelete);
          if (deleteError) throw deleteError;
        }

        // Separate transactions for UPDATE and INSERT
        const transactionsToUpdate = allTransactionsSafe.filter((t) => t.id);
        const transactionsToInsert = allTransactionsSafe.filter((t) => !t.id);

        // Update existing transactions
        if (transactionsToUpdate.length > 0) {
          const updatePromises = transactionsToUpdate.map((t) =>
            supabase
              .from("transactions")
              .update({
                debit_account_id: t.debit_account_id || null,
                credit_account_id: t.credit_account_id || null,
                amount: t.amount,
                debit_amount: t.debit_amount !== undefined ? t.debit_amount : 0,
                credit_amount: t.credit_amount !== undefined ? t.credit_amount : 0,
                description: t.description,
                currency: t.currency,
                date: format(data.document_date, "yyyy-MM-dd"),
                document_number: data.document_number,
                display_order: t.display_order,
                is_parallel: t.is_parallel || false,
              })
              .eq("id", t.id!),
          );

          const results = await Promise.all(updatePromises);
          const errors = results.filter((r) => r.error);
          if (errors.length > 0) {
            console.error("Error updating transactions:", errors);
            throw errors[0].error;
          }
        }

        // Insert new transactions
        if (transactionsToInsert.length > 0) {
          const transactionsData = transactionsToInsert.map((t) => ({
            document_id: documentId,
            debit_account_id: t.debit_account_id || null,
            credit_account_id: t.credit_account_id || null,
            amount: t.amount,
            debit_amount: t.debit_amount !== undefined ? t.debit_amount : 0,
            credit_amount: t.credit_amount !== undefined ? t.credit_amount : 0,
            description: t.description,
            currency: t.currency,
            date: format(data.document_date, "yyyy-MM-dd"),
            location_id: user.location,
            user_id: user.id,
            document_number: data.document_number,
            display_order: t.display_order,
            is_parallel: t.is_parallel || false,
          }));

          const { error: insertError } = await supabase.from("transactions").insert(transactionsData);
          if (insertError) {
            console.error("Error inserting transactions:", insertError);
            throw insertError;
          }
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
      console.error("Error saving document:", error);
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
    const currency = form.getValues("currency");
    const transactionWithCurrency = {
      ...transaction,
      currency,
      display_order: transactions.length + 1,
    };
    setTransactions((prev) => [...prev, transactionWithCurrency]);
    // Clear validation errors when a new transaction is added
    setValidationErrors([]);
  };

  const addParallelTransaction = async (transaction: Transaction) => {
    const currency = form.getValues("currency");
    const transactionWithCurrency = {
      ...transaction,
      currency,
      display_order: parallelTransactions.length + 1,
    };
    setParallelTransactions((prev) => [...prev, transactionWithCurrency]);
    // Clear validation errors when a new transaction is added
    setValidationErrors([]);
  };

  const removeTransaction = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
    // Clear validation errors when a transaction is removed
    setValidationErrors([]);
  };

  const removeParallelTransaction = (index: number) => {
    setParallelTransactions((prev) => prev.filter((_, i) => i !== index));
    // Clear validation errors when a transaction is removed
    setValidationErrors([]);
  };

  const handleUpdateTransaction = (index: number, updatedTransaction: Transaction) => {
    setTransactions((prev) =>
      prev.map((t, i) =>
        i === index
          ? {
              ...updatedTransaction,
              display_order: t.display_order, // ← ZACHOWAJ STARY display_order
            }
          : t,
      ),
    );
    // Clear validation errors when a transaction is updated
    setValidationErrors((prev) =>
      prev.filter(
        (e) => !(e.type === "incomplete_transaction" && e.transactionIndex === index && e.isParallel === false),
      ),
    );
  };

  const handleUpdateParallelTransaction = (index: number, updatedTransaction: Transaction) => {
    setParallelTransactions((prev) => prev.map((t, i) => (i === index ? updatedTransaction : t)));
    // Clear validation errors when a transaction is updated
    setValidationErrors((prev) =>
      prev.filter(
        (e) => !(e.type === "incomplete_transaction" && e.transactionIndex === index && e.isParallel === true),
      ),
    );
  };

  const handleSelectTransaction = (index: number, checked: boolean) => {
    setSelectedTransactions((prev) => (checked ? [...prev, index] : prev.filter((i) => i !== index)));
  };

  const handleSelectParallelTransaction = (index: number, checked: boolean) => {
    setSelectedParallelTransactions((prev) => (checked ? [...prev, index] : prev.filter((i) => i !== index)));
  };

  const handleCopyTransaction = (transaction: Transaction, isParallel: boolean = false) => {
    const currentTransactions = isParallel ? parallelTransactions : transactions;
    const newDisplayOrder = currentTransactions.length + 1;

    const newTransaction: Transaction = {
      ...transaction,
      id: undefined,
      isCloned: true,
      clonedType: transaction.credit_account_id ? "credit" : "debit",
      display_order: newDisplayOrder,
    };
    if (isParallel) {
      setParallelTransactions((prev) => [...prev, newTransaction]);
    } else {
      setTransactions((prev) => [...prev, newTransaction]);
    }
    toast({
      title: "Transakcja skopiowana",
      description: "Transakcja została dodana do listy",
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent, isParallel: boolean = false) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentTransactions = isParallel ? parallelTransactions : transactions;
      const oldIndex = currentTransactions.findIndex((t, i) => (t.id || `temp-${i}`) === active.id);
      const newIndex = currentTransactions.findIndex((t, i) => (t.id || `temp-${i}`) === over.id);

      console.log("🔄 Drag end:", { oldIndex, newIndex, isParallel });

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(currentTransactions, oldIndex, newIndex);

        // Update display_order for each transaction
        const updatedTransactions = reordered.map((t, index) => ({
          ...t,
          display_order: index + 1,
        }));

        console.log(
          "📝 Updated transactions with new order:",
          updatedTransactions.map((t) => ({
            id: t.id,
            display_order: t.display_order,
            description: t.description,
          })),
        );

        if (isParallel) {
          setParallelTransactions(updatedTransactions);
        } else {
          setTransactions(updatedTransactions);
        }
        setHasUnsavedChanges(true);

        // Mark as having unsaved changes - order will be saved when document is saved
        setHasUnsavedChanges(true);
        console.log("ℹ️ Transaction order changed, will be saved when document is saved");
      }
    }
  };

  const handleSplitTransaction = (transactionIndex: number, isParallel: boolean = false) => {
    // Pobierz AKTUALNĄ transakcję ze stanu, nie z closure - naprawia problem "stale closure"
    const transactionList = isParallel ? parallelTransactions : transactions;
    const transaction = transactionList[transactionIndex];
    
    if (!transaction) {
      toast({
        title: "Błąd",
        description: "Nie znaleziono transakcji do rozdzielenia",
        variant: "destructive",
      });
      return;
    }
    
    const debitAmount = transaction.debit_amount || 0;
    const creditAmount = transaction.credit_amount || 0;

    if (debitAmount === 0 && creditAmount === 0) {
      toast({
        title: "Błąd",
        description: "Brak kwot do rozdzielenia",
        variant: "destructive",
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
          variant: "destructive",
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
        // Only set account on the side that has an amount
        debit_account_id: isDebitSideSmaller ? transaction.debit_account_id : undefined,
        credit_account_id: isDebitSideSmaller ? undefined : transaction.credit_account_id,
      };

      if (isParallel) {
        setParallelTransactions((prev) => {
          if (transactionIndex !== undefined) {
            const newArray = [...prev];
            newArray.splice(transactionIndex + 1, 0, newTransaction);
            // Update display_order for all transactions after insertion
            return newArray.map((t, i) => ({ ...t, display_order: i + 1 }));
          }
          return [...prev, newTransaction];
        });
      } else {
        setTransactions((prev) => {
          if (transactionIndex !== undefined) {
            const newArray = [...prev];
            newArray.splice(transactionIndex + 1, 0, newTransaction);
            // Update display_order for all transactions after insertion
            return newArray.map((t, i) => ({ ...t, display_order: i + 1 }));
          }
          return [...prev, newTransaction];
        });
      }

      toast({
        title: "Kwota wyrównana",
        description: `Utworzono operację wyrównującą: ${balanceAmount.toFixed(2)} ${form.getValues("currency")}`,
      });
    } else {
      // Normal split: both fields have values
      const isDebitSmaller = debitAmount < creditAmount;
      const difference = Math.abs(debitAmount - creditAmount);

      if (difference === 0) {
        toast({
          title: "Błąd",
          description: "Kwoty są równe, nie ma czego rozdzielać",
          variant: "destructive",
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
        // Only set account on the side that has an amount
        debit_account_id: isDebitSmaller ? transaction.debit_account_id : undefined,
        credit_account_id: isDebitSmaller ? undefined : transaction.credit_account_id,
      };

      if (isParallel) {
        setParallelTransactions((prev) => {
          if (transactionIndex !== undefined) {
            const newArray = [...prev];
            newArray.splice(transactionIndex + 1, 0, newTransaction);
            // Update display_order for all transactions after insertion
            return newArray.map((t, i) => ({ ...t, display_order: i + 1 }));
          }
          return [...prev, newTransaction];
        });
      } else {
        setTransactions((prev) => {
          if (transactionIndex !== undefined) {
            const newArray = [...prev];
            newArray.splice(transactionIndex + 1, 0, newTransaction);
            // Update display_order for all transactions after insertion
            return newArray.map((t, i) => ({ ...t, display_order: i + 1 }));
          }
          return [...prev, newTransaction];
        });
      }

      toast({
        title: "Kwota rozdzielona",
        description: `Utworzono operację z kwotą: ${difference.toFixed(2)} ${form.getValues("currency")}`,
      });
    }
    
    setHasUnsavedChanges(true);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTransactions(checked ? transactions.map((_, index) => index) : []);
  };

  const handleSelectAllParallel = (checked: boolean) => {
    setSelectedParallelTransactions(checked ? parallelTransactions.map((_, index) => index) : []);
  };

  const handleCopySelected = () => {
    const selectedTrans = selectedTransactions.map((index) => transactions[index]);
    const copiedTransactions = selectedTrans.map((transaction) => ({
      ...transaction,
      debit_account_id: "",
      credit_account_id: "",
    }));

    setTransactions((prev) => [...prev, ...copiedTransactions]);
    setSelectedTransactions([]);

    toast({
      title: "Sukces",
      description: `Skopiowano ${copiedTransactions.length} operacji`,
    });
  };

  const handleParallelPosting = () => {
    const selectedTrans = selectedTransactions.map((index) => transactions[index]);
    // FIX: Nie zamieniamy stron - kopiujemy kwoty do odpowiednich miejsc
    const parallelTransactionsCopy = selectedTrans.map((transaction) => ({
      ...transaction,
      // Zachowujemy strony - Wn → Wn, Ma → Ma
      debit_account_id: "", // Konto zostawiamy puste do wypełnienia
      credit_account_id: "", // Konto zostawiamy puste do wypełnienia
      debit_amount: transaction.debit_amount, // Wn → Wn
      credit_amount: transaction.credit_amount, // Ma → Ma
    }));

    setParallelTransactions((prev) => [...prev, ...parallelTransactionsCopy]);
    setSelectedTransactions([]);

    toast({
      title: "Sukces",
      description: `Utworzono ${parallelTransactionsCopy.length} operacji równoległych`,
    });
  };

  const getCurrencySymbol = (currency: string = "PLN") => {
    const currencySymbols: { [key: string]: string } = {
      PLN: "zł",
      EUR: "€",
      USD: "$",
      GBP: "£",
      CHF: "CHF",
      CZK: "Kč",
      NOK: "kr",
      SEK: "kr",
    };
    return currencySymbols[currency] || currency;
  };

  const formatAmount = (amount: number, currency: string = "PLN") => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
        <DialogContent className="max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Sprawdzanie uprawnień...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Sprawdzanie czy dokument może być edytowany...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const selectedCurrency = form.watch("currency");

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{document ? "Edytuj dokument" : "Nowy dokument"}</DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureErrorScreenshot}
                disabled={isCapturingError}
                title="Zgłoś błąd"
              >
                <Bug className="h-4 w-4 mr-2" />
                {isCapturingError ? "Robię screenshot..." : "Zgłoś błąd"}
              </Button>
            </div>
          </DialogHeader>

          {isEditingBlocked && documentDate && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nie można zapisać dokumentu na datę {format(documentDate, "dd.MM.yyyy")}, ponieważ raport za ten okres
                został już złożony lub zatwierdzony.
                {!document && " Możesz wybrać inną datę."}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div
                className={cn(
                  "grid gap-4",
                  locationSettings?.allow_foreign_currencies
                    ? "grid-cols-1 md:grid-cols-3"
                    : "grid-cols-1 md:grid-cols-2",
                )}
              >
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
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
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
                          <CurrencySelector value={field.value} onChange={field.onChange} disabled={isEditingBlocked} />
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
                <Button type="submit" disabled={isLoading || (isEditingBlocked && Boolean(documentDate))}>
                  {isLoading ? "Zapisywanie..." : document ? "Zapisz zmiany" : "Utwórz dokument"}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInlineForm(true)}
                  className="flex items-center gap-2"
                  disabled={isEditingBlocked}
                >
                  <Plus className="h-4 w-4" />
                  Dodaj operację
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleDragEnd(event, false)}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-10 text-center">Lp.</TableHead>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedTransactions.length === transactions.length && transactions.length > 0}
                            onCheckedChange={handleSelectAll}
                            disabled={isEditingBlocked || transactions.length === 0}
                          />
                        </TableHead>
                        <TableHead className="w-[50%] min-w-[300px]">Opis</TableHead>
                        <TableHead className="text-right w-auto">Kwota Winien</TableHead>
                        <TableHead>Konto Winien</TableHead>
                        <TableHead className="text-right w-auto">Kwota Ma</TableHead>
                        <TableHead>Konto Ma</TableHead>
                        <TableHead>Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={transactions.map((t, i) => t.id || `temp-${i}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        {transactions.map((transaction, index) => {
                          const errorInfo = validationErrors.find(
                            (e) =>
                              e.type === "incomplete_transaction" &&
                              e.transactionIndex === index &&
                              e.isParallel === false,
                          );
                          return (
                            <SortableTransactionRow
                              key={transaction.id || `temp-${index}`}
                              id={transaction.id || `temp-${index}`}
                              index={index}
                              orderNumber={index + 1}
                              transaction={transaction}
                              onUpdate={(updatedTransaction) => handleUpdateTransaction(index, updatedTransaction)}
                              onDelete={() => removeTransaction(index)}
                              onCopy={() => handleCopyTransaction(transaction, false)}
                              onSplit={() => handleSplitTransaction(index, false)}
                              currency={selectedCurrency}
                              isEditingBlocked={isEditingBlocked}
                              isSelected={selectedTransactions.includes(index)}
                              onSelect={(checked) => handleSelectTransaction(index, checked)}
                              hasValidationError={!!errorInfo}
                              missingFields={errorInfo?.missingFields}
                            />
                          );
                        })}
                      </SortableContext>
                      {showInlineForm && (
                        <InlineTransactionRow
                          ref={inlineFormRef}
                          onSave={addTransaction}
                          isEditingBlocked={isEditingBlocked}
                          currency={selectedCurrency}
                          onHasDataChange={setHasInlineFormData}
                          hasValidationError={validationErrors.some((e) => e.type === "inline_form")}
                        />
                      )}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-gray-50 font-medium">
                        <TableCell colSpan={4} className="text-right font-bold">
                          RAZEM:
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatAmount(mainDebitSum, selectedCurrency)}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatAmount(mainCreditSum, selectedCurrency)}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-left font-bold">
                          Suma: {formatAmount(mainDebitSum + mainCreditSum, selectedCurrency)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </DndContext>
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
              {showParallelAccounting ? "Ukryj księgowanie równoległe" : "Pokaż księgowanie równoległe"}
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
                        const selectedTrans = selectedParallelTransactions.map((index) => parallelTransactions[index]);
                        const copiedTransactions = selectedTrans.map((transaction) => ({
                          ...transaction,
                          debit_account_id: "",
                          credit_account_id: "",
                        }));

                        setParallelTransactions((prev) => [...prev, ...copiedTransactions]);
                        setSelectedParallelTransactions([]);

                        toast({
                          title: "Sukces",
                          description: `Skopiowano ${copiedTransactions.length} operacji równoległych`,
                        });
                      }}
                      className="flex items-center gap-2"
                      disabled={isEditingBlocked}
                    >
                      <Copy className="h-4 w-4" />
                      Kopiuj ({selectedParallelTransactions.length})
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowParallelInlineForm(true)}
                    className="flex items-center gap-2"
                    disabled={isEditingBlocked}
                  >
                    <Plus className="h-4 w-4" />
                    Dodaj operację równoległą
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, true)}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-10 text-center">Lp.</TableHead>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                selectedParallelTransactions.length === parallelTransactions.length &&
                                parallelTransactions.length > 0
                              }
                              onCheckedChange={handleSelectAllParallel}
                              disabled={isEditingBlocked || parallelTransactions.length === 0}
                            />
                          </TableHead>
                          <TableHead className="w-[50%] min-w-[300px]">Opis</TableHead>
                          <TableHead className="text-right w-auto">Kwota Winien</TableHead>
                          <TableHead>Konto Winien</TableHead>
                          <TableHead className="text-right w-auto">Kwota Ma</TableHead>
                          <TableHead>Konto Ma</TableHead>
                          <TableHead>Akcje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext
                          items={parallelTransactions.map((t, i) => t.id || `temp-${i}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          {parallelTransactions.map((transaction, index) => {
                            const errorInfo = validationErrors.find(
                              (e) =>
                                e.type === "incomplete_transaction" &&
                                e.transactionIndex === index &&
                                e.isParallel === true,
                            );
                            return (
                              <SortableTransactionRow
                                key={transaction.id || `temp-${index}`}
                                id={transaction.id || `temp-${index}`}
                                index={index}
                                orderNumber={index + 1}
                                transaction={transaction}
                                onUpdate={(updatedTransaction) =>
                                  handleUpdateParallelTransaction(index, updatedTransaction)
                                }
                                onDelete={() => removeParallelTransaction(index)}
                                onCopy={() => handleCopyTransaction(transaction, true)}
                                onSplit={() => handleSplitTransaction(index, true)}
                                currency={selectedCurrency}
                                isEditingBlocked={isEditingBlocked}
                                isSelected={selectedParallelTransactions.includes(index)}
                                onSelect={(checked) => handleSelectParallelTransaction(index, checked)}
                                hasValidationError={!!errorInfo}
                                missingFields={errorInfo?.missingFields}
                              />
                            );
                          })}
                        </SortableContext>
                        {showParallelInlineForm && (
                          <InlineTransactionRow
                            ref={parallelInlineFormRef}
                            onSave={addParallelTransaction}
                            isEditingBlocked={isEditingBlocked}
                            currency={selectedCurrency}
                            onHasDataChange={setHasParallelInlineFormData}
                            hasValidationError={validationErrors.some((e) => e.type === "parallel_inline_form")}
                          />
                        )}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-gray-50 font-medium">
                          <TableCell colSpan={4} className="text-right font-bold">
                            RAZEM:
                          </TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            {formatAmount(parallelDebitSum, selectedCurrency)}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            {formatAmount(parallelCreditSum, selectedCurrency)}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-left font-bold">
                            Suma: {formatAmount(parallelDebitSum + parallelCreditSum, selectedCurrency)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </DndContext>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
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

            <div className="flex justify-end space-x-2">
              {document && (
                <Button type="button" variant="outline" onClick={handleExportToExcel} className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Drukuj
                </Button>
              )}
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
                onClick={form.handleSubmit(onSubmit)}
                disabled={isLoading || (isEditingBlocked && Boolean(documentDate))}
              >
                {isLoading ? "Zapisywanie..." : document ? "Zapisz zmiany" : "Utwórz dokument"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden printable version */}
      <PrintableDocument
        ref={printRef}
        documentNumber={form.getValues("document_number")}
        documentName={form.getValues("document_name")}
        documentDate={form.getValues("document_date")}
        currency={selectedCurrency}
        transactions={transactions}
        parallelTransactions={parallelTransactions}
        accounts={accounts || []}
        locationName={
          userProfile?.location_id ? locations?.find((l) => l.id === userProfile.location_id)?.name : undefined
        }
      />

      <ConfirmCloseDialog
        isOpen={showConfirmClose}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        onSave={handleSaveAndClose}
      />

      <ErrorReportDialog
        open={errorReportDialogOpen}
        onOpenChange={setErrorReportDialogOpen}
        autoScreenshot={errorScreenshot}
        pageUrl={window.location.href}
        browserInfo={getBrowserInfo()}
      />
    </>
  );
};

const SortableTransactionRow: React.FC<{
  id: string;
  index: number;
  orderNumber?: number;
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
  missingFields?: ValidationError["missingFields"];
}> = ({
  id,
  index,
  orderNumber,
  transaction,
  onUpdate,
  onDelete,
  onCopy,
  onSplit,
  currency,
  isEditingBlocked = false,
  isSelected = false,
  onSelect,
  hasValidationError = false,
  missingFields,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <EditableTransactionRow
      ref={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
      orderNumber={orderNumber}
      transaction={transaction}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onCopy={onCopy}
      onSplit={onSplit}
      currency={currency}
      isEditingBlocked={isEditingBlocked}
      isSelected={isSelected}
      onSelect={onSelect}
      hasValidationError={hasValidationError}
      missingFields={missingFields}
    />
  );
};

const EditableTransactionRow = React.forwardRef<
  HTMLTableRowElement,
  {
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
    missingFields?: ValidationError["missingFields"];
    style?: React.CSSProperties;
    dragHandleProps?: any;
    orderNumber?: number;
  }
>(
  (
    {
      transaction,
      onUpdate,
      onDelete,
      onCopy,
      onSplit,
      currency,
      isEditingBlocked = false,
      isSelected = false,
      onSelect,
      hasValidationError = false,
      missingFields,
      style,
      dragHandleProps,
      orderNumber,
    },
    ref,
  ) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
      description: transaction.description || "",
      debit_account_id: transaction.debit_account_id || "",
      credit_account_id: transaction.credit_account_id || "",
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
    }, [formData, currency, transaction.display_order, onUpdate]);

    const { data: userProfile } = useQuery({
      queryKey: ["userProfile"],
      queryFn: async () => {
        const { data, error } = await supabase.from("profiles").select("location_id").eq("id", user?.id).single();

        if (error) throw error;
        return data;
      },
      enabled: !!user?.id,
    });

    const getCurrencySymbol = (currency: string = "PLN") => {
      const currencySymbols: { [key: string]: string } = {
        PLN: "zł",
        EUR: "€",
        USD: "$",
        GBP: "£",
        CHF: "CHF",
        CZK: "Kč",
        NOK: "kr",
        SEK: "kr",
      };
      return currencySymbols[currency] || currency;
    };

    return (
      <TableRow
        ref={ref}
        style={style}
        className={cn(
          hasValidationError
            ? "bg-destructive/10 border-2 border-destructive"
            : isSelected
              ? "bg-blue-100 border-l-4 border-l-blue-500"
              : "hover:bg-gray-50",
        )}
      >
        <TableCell>
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </TableCell>
        <TableCell className="text-center font-mono text-sm text-muted-foreground">
          {orderNumber}
        </TableCell>
        <TableCell>
          <Checkbox checked={isSelected} onCheckedChange={onSelect} disabled={isEditingBlocked} />
        </TableCell>
        <TableCell>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Opis operacji..."
            className={cn(
              "min-h-[60px] resize-none",
              missingFields?.description && "border-destructive focus-visible:ring-destructive bg-destructive/5",
            )}
            disabled={isEditingBlocked}
          />
        </TableCell>
        <TableCell className="w-auto">
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              inputMode="decimal"
              value={formData.debit_amount ? formData.debit_amount.toFixed(2) : ""}
              onChange={(e) => {
                const normalizedValue = e.target.value.replace(",", ".");
                const value = parseFloat(normalizedValue) || 0;
                // Limit to 10 digits before decimal point
                if (Math.abs(value) < 10000000000) {
                  setFormData((prev) => ({ ...prev, debit_amount: value }));
                }
              }}
              onBlur={(e) => {
                // Format to 2 decimal places on blur
                if (formData.debit_amount > 0) {
                  setFormData((prev) => ({ ...prev, debit_amount: parseFloat(formData.debit_amount.toFixed(2)) }));
                }
              }}
              onKeyDown={(e) => {
                // Allow: digits, dot, comma, minus, backspace, delete, tab, arrows
                if (
                  !/[\d.,\-]/.test(e.key) &&
                  !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) &&
                  !e.ctrlKey && !e.metaKey
                ) {
                  e.preventDefault();
                }
              }}
              placeholder="0.00"
              style={{
                width: `${Math.max(60, (!formData.debit_amount ? 3 : formData.debit_amount.toFixed(2).length) + 130)}px`,
              }}
              className={cn(
                "text-right",
                isDebitReadOnly && "bg-muted text-muted-foreground cursor-not-allowed",
                missingFields?.debit_amount && "border-destructive focus-visible:ring-destructive bg-destructive/5",
              )}
              disabled={isEditingBlocked || isDebitReadOnly}
              readOnly={isDebitReadOnly}
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">{getCurrencySymbol(currency)}</span>
          </div>
        </TableCell>
        <TableCell>
          <AccountCombobox
            value={formData.debit_account_id}
            onChange={(accountId) => setFormData((prev) => ({ ...prev, debit_account_id: accountId }))}
            locationId={userProfile?.location_id}
            side="debit"
            disabled={isEditingBlocked || isDebitReadOnly}
            autoOpenOnFocus={true}
            className={cn(
              isDebitReadOnly && "opacity-50",
              missingFields?.debit_account_id && "border-destructive bg-destructive/5",
            )}
          />
        </TableCell>
        <TableCell className="w-auto">
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              inputMode="decimal"
              value={formData.credit_amount ? formData.credit_amount.toFixed(2) : ""}
              onChange={(e) => {
                const normalizedValue = e.target.value.replace(",", ".");
                const value = parseFloat(normalizedValue) || 0;
                // Limit to 10 digits before decimal point
                if (Math.abs(value) < 10000000000) {
                  setFormData((prev) => ({ ...prev, credit_amount: value }));
                }
              }}
              onBlur={(e) => {
                // Format to 2 decimal places on blur
                if (formData.credit_amount > 0) {
                  setFormData((prev) => ({ ...prev, credit_amount: parseFloat(formData.credit_amount.toFixed(2)) }));
                }
              }}
              onKeyDown={(e) => {
                // Allow: digits, dot, comma, minus, backspace, delete, tab, arrows
                if (
                  !/[\d.,\-]/.test(e.key) &&
                  !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) &&
                  !e.ctrlKey && !e.metaKey
                ) {
                  e.preventDefault();
                }
              }}
              placeholder="0.00"
              style={{
                width: `${Math.max(70, (formData.credit_amount === 0 || !formData.credit_amount ? 4 : formData.credit_amount.toString().length) + 130)}px`,
              }}
              className={cn(
                "text-right",
                isCreditReadOnly && "bg-muted text-muted-foreground cursor-not-allowed",
                missingFields?.credit_amount && "border-destructive focus-visible:ring-destructive bg-destructive/5",
              )}
              disabled={isEditingBlocked || isCreditReadOnly}
              readOnly={isCreditReadOnly}
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">{getCurrencySymbol(currency)}</span>
          </div>
        </TableCell>
        <TableCell>
          <AccountCombobox
            value={formData.credit_account_id}
            onChange={(accountId) => setFormData((prev) => ({ ...prev, credit_account_id: accountId }))}
            locationId={userProfile?.location_id}
            side="credit"
            disabled={isEditingBlocked || isCreditReadOnly}
            autoOpenOnFocus={true}
            className={cn(
              isCreditReadOnly && "opacity-50",
              missingFields?.credit_account_id && "border-destructive bg-destructive/5",
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
  },
);

EditableTransactionRow.displayName = "EditableTransactionRow";

export default DocumentDialog;
