import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AccountCombobox } from "./AccountCombobox";
import { Transaction } from "./types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export interface InlineTransactionRowRef {
  getCurrentData: () => Transaction | null;
}

interface InlineTransactionRowProps {
  onSave: (transaction: Transaction) => void;
  isEditingBlocked?: boolean;
  currency?: string;
  onHasDataChange?: (hasData: boolean) => void;
  hasValidationError?: boolean;
}

const InlineTransactionRow = forwardRef<InlineTransactionRowRef, InlineTransactionRowProps>(({
  onSave,
  isEditingBlocked = false,
  currency = "PLN",
  onHasDataChange,
  hasValidationError = false,
}, ref) => {
  const { user } = useAuth();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);

  const [formData, setFormData] = useState({
    description: "",
    debit_account_id: "",
    credit_account_id: "",
    debit_amount: 0,
    credit_amount: 0,
    settlement_type: "Bank" as "Gotówka" | "Bank" | "Rozrachunek",
  });

  const [creditTouched, setCreditTouched] = useState(false);
  const [debitTouched, setDebitTouched] = useState(false);

  // Check if there's any data entered
  const hasAnyData =
    formData.description.trim() !== "" ||
    formData.debit_amount > 0 ||
    formData.credit_amount > 0 ||
    formData.debit_account_id !== "" ||
    formData.credit_account_id !== "";

  // Notify parent about data changes
  useEffect(() => {
    onHasDataChange?.(hasAnyData);
  }, [hasAnyData, onHasDataChange]);

  // Expose getCurrentData method via ref
  useImperativeHandle(ref, () => ({
    getCurrentData: (): Transaction | null => {
      if (!hasAnyData) return null;
      return {
        description: formData.description,
        debit_account_id: formData.debit_account_id || undefined,
        credit_account_id: formData.credit_account_id || undefined,
        debit_amount: formData.debit_amount || 0,
        credit_amount: formData.credit_amount || 0,
        amount: Math.max(formData.debit_amount || 0, formData.credit_amount || 0),
        settlement_type: formData.settlement_type,
        currency: currency,
      };
    }
  }), [formData, hasAnyData, currency]);

  // Auto-focus on the first field when component mounts
  useEffect(() => {
    if (descriptionRef.current && !isEditingBlocked) {
      setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100);
    }
  }, [isEditingBlocked]);

  // Get user's location from profile
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("location_id").eq("id", user?.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check basic form validity (relaxed for balancing transactions) - supports negative amounts
  const isBasicFormValid = () => {
    return formData.description.trim() && formData.debit_amount !== 0 && formData.credit_amount !== 0;
  };

  // Check if all fields are filled (for equal amounts) - supports negative amounts
  const isFormValid =
    formData.description.trim() &&
    formData.debit_account_id &&
    formData.credit_account_id &&
    formData.debit_amount !== 0 &&
    formData.credit_amount !== 0;

  // Check if amounts are equal (with tolerance for floating point precision)
  const amountsEqual = Math.abs(Math.abs(formData.debit_amount) - Math.abs(formData.credit_amount)) <= 0.01;

  // Handle losing focus from the row - only save when amounts are equal
  const handleRowBlur = (event: React.FocusEvent) => {
    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget as Node;
    if (currentTarget.contains(relatedTarget)) return;

    if (isFormValid && amountsEqual && !isEditingBlocked) {
      console.log("Row blur - saving equal amounts transaction");
      const transaction: Transaction = {
        description: formData.description,
        debit_account_id: formData.debit_account_id,
        credit_account_id: formData.credit_account_id,
        debit_amount: formData.debit_amount,
        credit_amount: formData.credit_amount,
        amount: Math.max(formData.debit_amount, formData.credit_amount),
        settlement_type: formData.settlement_type,
        currency: currency,
      };
      onSave(transaction);
      resetForm();
    }
  };

  // Handle losing focus from debit amount field
  const handleDebitAmountBlur = () => {
    console.log("=== Debit amount blur triggered ===");
    console.log("Form data:", formData);

    // Format to 2 decimal places on blur
    if (formData.debit_amount > 0) {
      handleDebitAmountChange(parseFloat(formData.debit_amount.toFixed(2)));
    }

    const difference = Math.abs(formData.debit_amount - formData.credit_amount);
    console.log("Amount comparison:", {
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      difference: difference,
      debitSmaller: formData.debit_amount < formData.credit_amount,
      significantDifference: difference > 0.01,
      basicFormValid: isBasicFormValid(),
      creditAccountSelected: !!formData.credit_account_id,
    });

    const canCreateBalancing =
      isBasicFormValid() &&
      formData.credit_account_id &&
      difference > 0.01 &&
      formData.debit_amount < formData.credit_amount;

    if (canCreateBalancing && !isEditingBlocked) {
      console.log("✓ Creating balancing transaction - debit is smaller");
      createBalancingTransaction("debit");
    } else {
      console.log("✗ Balancing not triggered. Reasons:", {
        basicFormValid: isBasicFormValid(),
        creditAccountSelected: !!formData.credit_account_id,
        significantDifference: difference > 0.01,
        debitSmaller: formData.debit_amount < formData.credit_amount,
        editingBlocked: isEditingBlocked,
      });
    }
  };

  // Handle losing focus from credit amount field
  const handleCreditAmountBlur = () => {
    console.log("=== Credit amount blur triggered ===");
    console.log("Form data:", formData);

    // Format to 2 decimal places on blur
    if (formData.credit_amount > 0) {
      handleCreditAmountChange(parseFloat(formData.credit_amount.toFixed(2)));
    }

    const difference = Math.abs(formData.debit_amount - formData.credit_amount);
    console.log("Amount comparison:", {
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      difference: difference,
      creditSmaller: formData.credit_amount < formData.debit_amount,
      significantDifference: difference > 0.01,
      basicFormValid: isBasicFormValid(),
      debitAccountSelected: !!formData.debit_account_id,
    });

    const canCreateBalancing =
      isBasicFormValid() &&
      formData.debit_account_id &&
      difference > 0.01 &&
      formData.credit_amount < formData.debit_amount;

    if (canCreateBalancing && !isEditingBlocked) {
      console.log("✓ Creating balancing transaction - credit is smaller");
      createBalancingTransaction("credit");
    } else {
      console.log("✗ Balancing not triggered. Reasons:", {
        basicFormValid: isBasicFormValid(),
        debitAccountSelected: !!formData.debit_account_id,
        significantDifference: difference > 0.01,
        creditSmaller: formData.credit_amount < formData.debit_amount,
        editingBlocked: isEditingBlocked,
      });
    }
  };

  // Create balancing transaction when one side is smaller
  const createBalancingTransaction = (smallerSide: "debit" | "credit") => {
    console.log("🔄 Creating balancing transaction for smaller side:", smallerSide);
    const originalTransaction: Transaction = {
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(formData.debit_amount, formData.credit_amount),
      settlement_type: formData.settlement_type,
      currency: currency,
    };
    console.log("💾 Saving original transaction:", originalTransaction);
    onSave(originalTransaction);

    const difference = Math.abs(formData.debit_amount - formData.credit_amount);
    const balancingTransaction: Transaction = {
      description: formData.description,
      debit_account_id: smallerSide === "debit" ? "" : formData.debit_account_id,
      credit_account_id: smallerSide === "credit" ? "" : formData.credit_account_id,
      debit_amount: smallerSide === "debit" ? difference : 0,
      credit_amount: smallerSide === "credit" ? difference : 0,
      amount: difference,
      settlement_type: formData.settlement_type,
      currency: currency,
    };
    console.log("💾 Saving balancing transaction:", balancingTransaction);
    onSave(balancingTransaction);
    resetForm();
  };

  // Helper function to reset form
  const resetForm = () => {
    setFormData({
      description: "",
      debit_account_id: "",
      credit_account_id: "",
      debit_amount: 0,
      credit_amount: 0,
      settlement_type: "Bank" as "Gotówka" | "Bank" | "Rozrachunek",
    });
    setCreditTouched(false);
    setDebitTouched(false);
    setTimeout(() => {
      if (descriptionRef.current && !isEditingBlocked) {
        descriptionRef.current.focus();
      }
    }, 100);
  };

  // Auto-populate logic for debit amount changes
  const handleDebitAmountChange = (value: number) => {
    setFormData((prev) => {
      const newData = { ...prev, debit_amount: value };
      // Auto-fill credit if not touched and value is not zero (supports negative amounts)
      if (!creditTouched && value !== 0) {
        newData.credit_amount = value;
      }
      return newData;
    });
  };

  // Auto-populate logic for credit amount changes
  const handleCreditAmountChange = (value: number) => {
    setFormData((prev) => {
      const newData = { ...prev, credit_amount: value };
      // Auto-fill debit if not touched and value is not zero (supports negative amounts)
      if (!debitTouched && value !== 0) {
        newData.debit_amount = value;
      }
      return newData;
    });
  };

  const handleDebitFocus = () => {
    setDebitTouched(true);
  };

  const handleCreditFocus = () => {
    setCreditTouched(true);
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

  const handleSaveWithBalancing = () => {
    if (!formData.description.trim() || !formData.debit_account_id || !formData.credit_account_id) return;
    if (formData.debit_amount === 0 || formData.credit_amount === 0) return;

    const amountsAreEqual = Math.abs(Math.abs(formData.debit_amount) - Math.abs(formData.credit_amount)) <= 0.01;
    const transaction: Transaction = {
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: formData.debit_amount,
      credit_amount: formData.credit_amount,
      amount: Math.max(Math.abs(formData.debit_amount), Math.abs(formData.credit_amount)),
      settlement_type: formData.settlement_type,
      currency: currency,
    };
    onSave(transaction);

    if (!amountsAreEqual) {
      const difference = Math.abs(Math.abs(formData.debit_amount) - Math.abs(formData.credit_amount));
      const isDebitLarger = Math.abs(formData.debit_amount) > Math.abs(formData.credit_amount);
      const balancingTransaction: Transaction = {
        description: formData.description,
        debit_account_id: isDebitLarger ? "" : formData.credit_account_id,
        credit_account_id: !isDebitLarger ? "" : formData.debit_account_id,
        debit_amount: isDebitLarger ? 0 : difference,
        credit_amount: !isDebitLarger ? 0 : difference,
        amount: difference,
        settlement_type: formData.settlement_type,
        currency: currency,
      };
      onSave(balancingTransaction);
    }
    resetForm();
  };

  return (
    <TableRow
      ref={rowRef}
      className={cn(
        hasValidationError ? "bg-destructive/20 border-2 border-destructive" : "bg-blue-50 border-2 border-blue-200",
      )}
      onBlur={handleRowBlur}
    >
      <TableCell>{/* Empty cell for drag handle */}</TableCell>
      <TableCell className="text-center font-mono text-sm text-muted-foreground">-</TableCell>
      <TableCell>{/* Empty cell for checkbox */}</TableCell>
      <TableCell>
        <Textarea
          ref={descriptionRef}
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="Opis operacji..."
          className={cn(
            "min-h-[60px] resize-none",
            hasValidationError && "border-destructive focus-visible:ring-destructive",
          )}
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell className="w-auto">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            inputMode="decimal"
            value={formData.debit_amount === 0 ? "" : formData.debit_amount.toFixed(2)}
            onChange={(e) => {
              const value = e.target.value.replace(",", ".");
              const numValue = parseFloat(value) || 0;
              // Limit to 10 digits before decimal point
              if (Math.abs(numValue) < 10000000000) {
                handleDebitAmountChange(numValue);
              }
            }}
            onFocus={handleDebitFocus}
            onBlur={(e) => {
              // Format to 2 decimal places on blur
              if (formData.debit_amount > 0) {
                handleDebitAmountChange(parseFloat(formData.debit_amount.toFixed(2)));
              }
              handleDebitAmountBlur();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
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
              width: `${Math.max(70, (formData.debit_amount === 0 ? 4 : formData.debit_amount.toString().length) + 130)}px` 
            }}
            className={cn("text-right", hasValidationError && "border-destructive focus-visible:ring-destructive")}
            disabled={isEditingBlocked}
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
          disabled={isEditingBlocked}
          autoOpenOnFocus={true}
          className={hasValidationError ? "border-destructive" : ""}
        />
      </TableCell>
      <TableCell className="w-auto">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            inputMode="decimal"
            value={formData.credit_amount === 0 ? "" : formData.credit_amount.toFixed(2)}
            onChange={(e) => {
              const value = e.target.value.replace(",", ".");
              const numValue = parseFloat(value) || 0;
              // Limit to 10 digits before decimal point
              if (Math.abs(numValue) < 10000000000) {
                handleCreditAmountChange(numValue);
              }
            }}
            onFocus={handleCreditFocus}
            onBlur={(e) => {
              // Format to 2 decimal places on blur
              if (formData.credit_amount > 0) {
                handleCreditAmountChange(parseFloat(formData.credit_amount.toFixed(2)));
              }
              handleCreditAmountBlur();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
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
              width: `${Math.max(70, (formData.credit_amount === 0 ? 4 : formData.credit_amount.toString().length) + 130)}px` 
            }}
            className={cn("text-right", hasValidationError && "border-destructive focus-visible:ring-destructive")}
            disabled={isEditingBlocked}
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
          disabled={isEditingBlocked}
          autoOpenOnFocus={true}
          className={hasValidationError ? "border-destructive" : ""}
        />
      </TableCell>
      <TableCell>{/* No action buttons - auto-save handles submission */}</TableCell>
    </TableRow>
  );
});

InlineTransactionRow.displayName = 'InlineTransactionRow';

export default InlineTransactionRow;
