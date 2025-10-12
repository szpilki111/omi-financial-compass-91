import React, { useState, useEffect, useRef } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AccountCombobox } from "./AccountCombobox";
import { Transaction } from "./types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface InlineTransactionRowProps {
  onSave: (transaction: Transaction) => void;
  isEditingBlocked?: boolean;
  currency?: string;
  onHasDataChange?: (hasData: boolean) => void;
  hasValidationError?: boolean;
}

const InlineTransactionRow: React.FC<InlineTransactionRowProps> = ({
  onSave,
  isEditingBlocked = false,
  currency = "PLN",
  onHasDataChange,
  hasValidationError = false,
}) => {
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

  // Check basic form validity (relaxed for balancing transactions)
  const isBasicFormValid = () => {
    return formData.description.trim() && formData.debit_amount > 0 && formData.credit_amount > 0;
  };

  // Check if all fields are filled (for equal amounts)
  const isFormValid =
    formData.description.trim() &&
    formData.debit_account_id &&
    formData.credit_account_id &&
    formData.debit_amount > 0 &&
    formData.credit_amount > 0;

  // Check if amounts are equal (with tolerance for floating point precision)
  const amountsEqual = Math.abs(formData.debit_amount - formData.credit_amount) <= 0.01;

  // Handle losing focus from the row - only save when amounts are equal
  const handleRowBlur = (event: React.FocusEvent) => {
    // Check if the new focus target is still within this row
    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget as Node;

    if (currentTarget.contains(relatedTarget)) {
      // Focus is still within the row, don't trigger processing
      return;
    }

    // Only save if form is valid, amounts are equal, and editing is not blocked
    if (isFormValid && amountsEqual && !isEditingBlocked) {
      console.log("Row blur - saving equal amounts transaction");
      
      // Format amounts to .00 if they are integers
      const debitAmount = Number.isInteger(formData.debit_amount) 
        ? parseFloat(formData.debit_amount.toFixed(2)) 
        : formData.debit_amount;
      const creditAmount = Number.isInteger(formData.credit_amount) 
        ? parseFloat(formData.credit_amount.toFixed(2)) 
        : formData.credit_amount;
      
      const transaction: Transaction = {
        description: formData.description,
        debit_account_id: formData.debit_account_id,
        credit_account_id: formData.credit_account_id,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        amount: Math.max(debitAmount, creditAmount),
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

    // Relaxed validation: check if we have basic form data + credit account (since debit is smaller)
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

    // Relaxed validation: check if we have basic form data + debit account (since credit is smaller)
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

    // Format amounts to .00 if they are integers
    const debitAmount = Number.isInteger(formData.debit_amount) 
      ? parseFloat(formData.debit_amount.toFixed(2)) 
      : formData.debit_amount;
    const creditAmount = Number.isInteger(formData.credit_amount) 
      ? parseFloat(formData.credit_amount.toFixed(2)) 
      : formData.credit_amount;

    // Save the original transaction first
    const originalTransaction: Transaction = {
      description: formData.description,
      debit_account_id: formData.debit_account_id,
      credit_account_id: formData.credit_account_id,
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      amount: Math.max(debitAmount, creditAmount),
      settlement_type: formData.settlement_type,
      currency: currency,
    };

    console.log("💾 Saving original transaction:", originalTransaction);
    onSave(originalTransaction);

    const difference = Math.abs(debitAmount - creditAmount);
    const formattedDifference = Number.isInteger(difference) 
      ? parseFloat(difference.toFixed(2)) 
      : difference;

    // Create the balancing transaction
    const balancingTransaction: Transaction = {
      description: formData.description,
      debit_account_id: smallerSide === "debit" ? "" : formData.debit_account_id,
      credit_account_id: smallerSide === "credit" ? "" : formData.credit_account_id,
      debit_amount: smallerSide === "debit" ? formattedDifference : 0,
      credit_amount: smallerSide === "credit" ? formattedDifference : 0,
      amount: formattedDifference,
      settlement_type: formData.settlement_type,
      currency: currency,
    };

    console.log("💾 Saving balancing transaction:", balancingTransaction);
    onSave(balancingTransaction);

    // Reset form for next operation
    resetForm();
  };

  // Helper function to reset form - clear all fields for fresh operation
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

    // Auto-focus on description field for next transaction
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

      // Auto-populate credit amount if credit hasn't been manually touched and value > 0
      if (!creditTouched && value > 0) {
        newData.credit_amount = value;
      }

      return newData;
    });
  };

  // Auto-populate logic for credit amount changes
  const handleCreditAmountChange = (value: number) => {
    setFormData((prev) => {
      const newData = { ...prev, credit_amount: value };

      // Auto-populate debit amount if debit hasn't been manually touched and value > 0
      if (!debitTouched && value > 0) {
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
    if (!formData.description.trim() || !formData.debit_account_id || !formData.credit_account_id) {
      return;
    }

    if (formData.debit_amount <= 0 || formData.credit_amount <= 0) {
      return;
    }

    // Check if amounts are equal
    const amountsAreEqual = Math.abs(formData.debit_amount - formData.credit_amount) <= 0.01;

    if (amountsAreEqual) {
      // Format amounts to .00 if they are integers
      const debitAmount = Number.isInteger(formData.debit_amount) 
        ? parseFloat(formData.debit_amount.toFixed(2)) 
        : formData.debit_amount;
      const creditAmount = Number.isInteger(formData.credit_amount) 
        ? parseFloat(formData.credit_amount.toFixed(2)) 
        : formData.credit_amount;
      
      // Amounts equal - save current transaction and reset form for fresh operation
      const transaction: Transaction = {
        description: formData.description,
        debit_account_id: formData.debit_account_id,
        credit_account_id: formData.credit_account_id,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        amount: Math.max(debitAmount, creditAmount),
        settlement_type: formData.settlement_type,
        currency: currency,
      };

      onSave(transaction);

      // Reset form state for next transaction - clear all fields
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

      // Auto-focus on description field for next transaction
      setTimeout(() => {
        if (descriptionRef.current && !isEditingBlocked) {
          descriptionRef.current.focus();
        }
      }, 100);
    } else {
      // Format amounts to .00 if they are integers
      const debitAmount = Number.isInteger(formData.debit_amount) 
        ? parseFloat(formData.debit_amount.toFixed(2)) 
        : formData.debit_amount;
      const creditAmount = Number.isInteger(formData.credit_amount) 
        ? parseFloat(formData.credit_amount.toFixed(2)) 
        : formData.credit_amount;
      
      // Amounts different - save original transaction and create balancing transaction
      const transaction: Transaction = {
        description: formData.description,
        debit_account_id: formData.debit_account_id,
        credit_account_id: formData.credit_account_id,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        amount: Math.max(debitAmount, creditAmount),
        settlement_type: formData.settlement_type,
        currency: currency,
      };

      onSave(transaction);

      const difference = Math.abs(debitAmount - creditAmount);
      const formattedDifference = Number.isInteger(difference) 
        ? parseFloat(difference.toFixed(2)) 
        : difference;
      const isDebitLarger = debitAmount > creditAmount;

      // Create the balancing transaction
      const balancingTransaction: Transaction = {
        description: formData.description, // Copy the same description
        debit_account_id: isDebitLarger ? "" : formData.credit_account_id, // Fill same side account
        credit_account_id: !isDebitLarger ? "" : formData.debit_account_id, // Fill same side account
        debit_amount: isDebitLarger ? 0 : formattedDifference, // Fill the balancing amount
        credit_amount: !isDebitLarger ? 0 : formattedDifference, // Fill the balancing amount
        amount: formattedDifference,
        settlement_type: formData.settlement_type,
        currency: currency,
      };

      // Save the balancing transaction
      onSave(balancingTransaction);

      // Reset form for next operation - clear all fields
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

      // Auto-focus on description field for next transaction
      setTimeout(() => {
        if (descriptionRef.current && !isEditingBlocked) {
          descriptionRef.current.focus();
        }
      }, 100);
    }
  };

  return (
    <TableRow
      ref={rowRef}
      className={cn(
        hasValidationError ? "bg-destructive/20 border-2 border-destructive" : "bg-blue-50 border-2 border-blue-200",
      )}
      onBlur={handleRowBlur}
    >
      <TableCell>{/* Pusta komórka dla checkboxa */}</TableCell>
      <TableCell>
        <Textarea
          ref={descriptionRef}
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder="Opis operacji..."
          className={cn(
            "min-h-[60px] resize-none",
            hasValidationError && "border-destructive focus-visible:ring-destructive",
          )}
          disabled={isEditingBlocked}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            inputMode="decimal"
            value={formData.debit_amount === 0 ? "" : (Number.isInteger(formData.debit_amount) ? formData.debit_amount.toFixed(2) : formData.debit_amount)}
            onChange={(e) => {
              const value = e.target.value;
              handleDebitAmountChange(parseFloat(value) || 0);
            }}
            onFocus={handleDebitFocus}
            onBlur={(e) => {
              // Format to .00 only if value is integer and no decimal point was entered
              const inputValue = e.target.value;
              if (formData.debit_amount > 0 && !inputValue.includes('.') && !inputValue.includes(',')) {
                // Value is already a number, display formatting happens in value prop
                handleDebitAmountChange(formData.debit_amount);
              }
              handleDebitAmountBlur();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
              // Allow Tab, numbers, decimal point, and control keys
              if (
                e.key !== "Tab" &&
                !/[\d.,\b\r]/.test(e.key) &&
                !e.ctrlKey &&
                !e.metaKey &&
                e.key !== "ArrowLeft" &&
                e.key !== "ArrowRight" &&
                e.key !== "Delete"
              ) {
                e.preventDefault();
              }
            }}
            placeholder="0.00"
            className={cn("text-right", hasValidationError && "border-destructive focus-visible:ring-destructive")}
            disabled={isEditingBlocked}
          />
          <span className="text-sm text-gray-500">{getCurrencySymbol(currency)}</span>
        </div>
      </TableCell>
      <TableCell>
        <AccountCombobox
          value={formData.debit_account_id}
          onChange={(accountId) => setFormData((prev) => ({ ...prev, debit_account_id: accountId }))}
          locationId={userProfile?.location_id}
          side="debit"
          disabled={isEditingBlocked}
          className={hasValidationError ? "border-destructive" : ""}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            inputMode="decimal"
            value={formData.credit_amount === 0 ? "" : (Number.isInteger(formData.credit_amount) ? formData.credit_amount.toFixed(2) : formData.credit_amount)}
            onChange={(e) => {
              const value = e.target.value;
              handleCreditAmountChange(parseFloat(value) || 0);
            }}
            onFocus={handleCreditFocus}
            onBlur={(e) => {
              // Format to .00 only if value is integer and no decimal point was entered
              const inputValue = e.target.value;
              if (formData.credit_amount > 0 && !inputValue.includes('.') && !inputValue.includes(',')) {
                // Value is already a number, display formatting happens in value prop
                handleCreditAmountChange(formData.credit_amount);
              }
              handleCreditAmountBlur();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
              // Allow Tab, numbers, decimal point, and control keys
              if (
                e.key !== "Tab" &&
                !/[\d.,\b\r]/.test(e.key) &&
                !e.ctrlKey &&
                !e.metaKey &&
                e.key !== "ArrowLeft" &&
                e.key !== "ArrowRight" &&
                e.key !== "Delete"
              ) {
                e.preventDefault();
              }
            }}
            placeholder="0.00"
            className={cn("text-right", hasValidationError && "border-destructive focus-visible:ring-destructive")}
            disabled={isEditingBlocked}
          />
          <span className="text-sm text-gray-500">{getCurrencySymbol(currency)}</span>
        </div>
      </TableCell>
      <TableCell>
        <AccountCombobox
          value={formData.credit_account_id}
          onChange={(accountId) => setFormData((prev) => ({ ...prev, credit_account_id: accountId }))}
          locationId={userProfile?.location_id}
          side="credit"
          disabled={isEditingBlocked}
          className={hasValidationError ? "border-destructive" : ""}
        />
      </TableCell>
      <TableCell>{/* No action buttons - auto-save handles submission */}</TableCell>
    </TableRow>
  );
};

export default InlineTransactionRow;
