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

const InlineTransactionRow = forwardRef<InlineTransactionRowRef, InlineTransactionRowProps>(
  ({ onSave, isEditingBlocked = false, currency = "PLN", onHasDataChange, hasValidationError = false }, ref) => {
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

    // Local state for amount input fields to allow free typing
    const [debitAmountInput, setDebitAmountInput] = useState<string>("");
    const [creditAmountInput, setCreditAmountInput] = useState<string>("");
    const [isDebitFocused, setIsDebitFocused] = useState(false);
    const [isCreditFocused, setIsCreditFocused] = useState(false);

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
    useImperativeHandle(
      ref,
      () => ({
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
        },
      }),
      [formData, hasAnyData, currency],
    );

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

    // Handle losing focus from the row - save transaction or create split
    const handleRowBlur = (event: React.FocusEvent) => {
      const currentTarget = event.currentTarget;
      const relatedTarget = event.relatedTarget as Node;
      if (currentTarget.contains(relatedTarget)) return;

      // Must have description, both accounts, and both amounts to save
      if (!isFormValid || isEditingBlocked) return;

      const debitAbs = Math.abs(formData.debit_amount);
      const creditAbs = Math.abs(formData.credit_amount);
      const difference = Math.abs(debitAbs - creditAbs);

      if (difference <= 0.01) {
        // Amounts are equal - save single transaction
        console.log("Row blur - saving equal amounts transaction");
        const transaction: Transaction = {
          description: formData.description,
          debit_account_id: formData.debit_account_id,
          credit_account_id: formData.credit_account_id,
          debit_amount: formData.debit_amount,
          credit_amount: formData.credit_amount,
          amount: Math.max(debitAbs, creditAbs),
          settlement_type: formData.settlement_type,
          currency: currency,
        };
        onSave(transaction);
        resetForm();
      } else {
        // Amounts are different - create split (original + balancing)
        console.log("Row blur - creating split transaction, difference:", difference);

        // Save original transaction
        const originalTransaction: Transaction = {
          description: formData.description,
          debit_account_id: formData.debit_account_id,
          credit_account_id: formData.credit_account_id,
          debit_amount: formData.debit_amount,
          credit_amount: formData.credit_amount,
          amount: Math.max(debitAbs, creditAbs),
          settlement_type: formData.settlement_type,
          currency: currency,
        };
        console.log("💾 Saving original transaction:", originalTransaction);
        onSave(originalTransaction);

        // Create balancing transaction
        // When debit < credit: balancing line has debit_amount=difference, credit_amount=0
        // When credit < debit: balancing line has debit_amount=0, credit_amount=difference
        const isDebitSmaller = debitAbs < creditAbs;
        const balancingTransaction: Transaction = {
          description: formData.description,
          debit_account_id: isDebitSmaller ? formData.debit_account_id : "",
          credit_account_id: isDebitSmaller ? "" : formData.credit_account_id,
          debit_amount: isDebitSmaller ? difference : 0,
          credit_amount: isDebitSmaller ? 0 : difference,
          amount: difference,
          settlement_type: formData.settlement_type,
          currency: currency,
        };
        console.log("💾 Saving balancing transaction:", balancingTransaction);
        onSave(balancingTransaction);
        resetForm();
      }
    };

    // Handle losing focus from debit amount field - formatting only (split logic moved to handleRowBlur)
    const handleDebitAmountBlur = () => {
      // Format to 2 decimal places on blur
      if (formData.debit_amount !== 0) {
        handleDebitAmountChange(parseFloat(formData.debit_amount.toFixed(2)));
      }
    };

    // Handle losing focus from credit amount field - formatting only (split logic moved to handleRowBlur)
    const handleCreditAmountBlur = () => {
      // Format to 2 decimal places on blur
      if (formData.credit_amount !== 0) {
        handleCreditAmountChange(parseFloat(formData.credit_amount.toFixed(2)));
      }
    };

    // createBalancingTransaction removed - logic consolidated into handleRowBlur

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
      setIsDebitFocused(true);
    };

    const handleCreditFocus = () => {
      setCreditTouched(true);
      setIsCreditFocused(true);
    };

    // Sync local input state with formData when not focused
    useEffect(() => {
      if (!isDebitFocused) {
        setDebitAmountInput(formData.debit_amount === 0 ? "" : formData.debit_amount.toFixed(2));
      }
    }, [formData.debit_amount, isDebitFocused]);

    useEffect(() => {
      if (!isCreditFocused) {
        setCreditAmountInput(formData.credit_amount === 0 ? "" : formData.credit_amount.toFixed(2));
      }
    }, [formData.credit_amount, isCreditFocused]);

    const getCurrencySymbol = (currency: string = "PLN") => {
      const symbols: { [key: string]: string } = {
        PLN: "zł",
        EUR: "€",
        USD: "$",
        CAD: "C$",
        NOK: "kr",
        AUD: "A$",
      };
      return symbols[currency] || currency;
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
              value={debitAmountInput}
              onChange={(e) => {
                const inputValue = e.target.value;
                setDebitAmountInput(inputValue);

                if (inputValue === "" || inputValue === "-") {
                  handleDebitAmountChange(0);
                  return;
                }

                const normalizedValue = inputValue.replace(",", ".");
                const numValue = parseFloat(normalizedValue);
                if (!isNaN(numValue) && Math.abs(numValue) < 10000000000) {
                  handleDebitAmountChange(numValue);
                }
              }}
              onFocus={handleDebitFocus}
              onBlur={() => {
                setIsDebitFocused(false);
                const normalizedValue = debitAmountInput.replace(",", ".");
                const numValue = parseFloat(normalizedValue) || 0;
                handleDebitAmountChange(numValue);
                setDebitAmountInput(numValue === 0 ? "" : numValue.toFixed(2));
                handleDebitAmountBlur();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="0.00"
              style={{
                width: `${Math.max(70, (debitAmountInput.length || 4) + 130)}px`,
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
              value={creditAmountInput}
              onChange={(e) => {
                const inputValue = e.target.value;
                setCreditAmountInput(inputValue);

                if (inputValue === "" || inputValue === "-") {
                  handleCreditAmountChange(0);
                  return;
                }

                const normalizedValue = inputValue.replace(",", ".");
                const numValue = parseFloat(normalizedValue);
                if (!isNaN(numValue) && Math.abs(numValue) < 10000000000) {
                  handleCreditAmountChange(numValue);
                }
              }}
              onFocus={handleCreditFocus}
              onBlur={() => {
                setIsCreditFocused(false);
                const normalizedValue = creditAmountInput.replace(",", ".");
                const numValue = parseFloat(normalizedValue) || 0;
                handleCreditAmountChange(numValue);
                setCreditAmountInput(numValue === 0 ? "" : numValue.toFixed(2));
                handleCreditAmountBlur();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="0.00"
              style={{
                width: `${Math.max(70, (creditAmountInput.length || 4) + 130)}px`,
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
  },
);

InlineTransactionRow.displayName = "InlineTransactionRow";

export default InlineTransactionRow;
