import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

interface ExportToExcelProps {
  reportId: string;
  reportTitle: string;
  locationName: string;
  period: string;
  year: number;
  month: number;
  locationId: string;
}

interface AccountBreakdown {
  accountNumber: string;
  accountName: string;
  totalAmount: number;
  side: "WN" | "MA";
}

export const ExportToExcel: React.FC<ExportToExcelProps> = ({
  reportId,
  reportTitle,
  locationName,
  period,
  year,
  month,
  locationId,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch report details
      const { data: reportDetails, error: detailsError } = await supabase
        .from("report_details")
        .select("*")
        .eq("report_id", reportId)
        .single();

      if (detailsError && detailsError.code !== "PGRST116") throw detailsError;

      // Calculate date range for the month
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      const dateFrom = firstDayOfMonth.toISOString().split("T")[0];
      const dateTo = lastDayOfMonth.toISOString().split("T")[0];

      // Fetch transactions for the period
      const { data: transactions, error: transactionsError } = await supabase
        .from("transactions")
        .select(
          `
          *,
          debit_account:accounts!transactions_debit_account_id_fkey(id, number, name),
          credit_account:accounts!transactions_credit_account_id_fkey(id, number, name)
        `,
        )
        .eq("location_id", locationId)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      if (transactionsError) throw transactionsError;

      // Funkcja do wyodrębnienia numeru konta syntetycznego (max 3 segmenty)
      const getSyntheticAccountNumber = (accountNumber: string): string => {
        if (!accountNumber) return accountNumber;
        const segments = accountNumber.split("-");
        if (segments.length <= 3) {
          return accountNumber;
        }
        return segments.slice(0, 3).join("-");
      };

      // Zbierz unikalne numery kont syntetycznych
      const syntheticNumbersSet = new Set<string>();
      transactions?.forEach((transaction) => {
        if (transaction.debit_account) {
          syntheticNumbersSet.add(getSyntheticAccountNumber(transaction.debit_account.number));
        }
        if (transaction.credit_account) {
          syntheticNumbersSet.add(getSyntheticAccountNumber(transaction.credit_account.number));
        }
      });

      // Pobierz nazwy kont syntetycznych z bazy
      const syntheticNumbers = Array.from(syntheticNumbersSet);
      let syntheticAccountsMap = new Map<string, string>();

      if (syntheticNumbers.length > 0) {
        const { data: syntheticAccounts } = await supabase
          .from("accounts")
          .select("number, name")
          .in("number", syntheticNumbers);

        syntheticAccounts?.forEach((acc) => {
          syntheticAccountsMap.set(acc.number, acc.name);
        });
      }

      // Process transactions to get account breakdown - agregując do kont syntetycznych
      const accountMap = new Map<string, AccountBreakdown>();

      transactions?.forEach((transaction) => {
        // Process debit account (WN)
        if (transaction.debit_account) {
          const acc = transaction.debit_account;
          const syntheticNumber = getSyntheticAccountNumber(acc.number);
          const prefix = syntheticNumber.split("-")[0];
          const amount = transaction.debit_amount || transaction.amount || 0;

          // Only include 4xx (expenses) and 2xx accounts on debit side
          if (prefix.startsWith("4") || prefix.startsWith("2")) {
            const key = `${syntheticNumber}-WN`;
            const existing = accountMap.get(key);
            if (existing) {
              existing.totalAmount += amount;
            } else {
              const syntheticName = syntheticAccountsMap.get(syntheticNumber) || acc.name;
              accountMap.set(key, {
                accountNumber: syntheticNumber,
                accountName: syntheticName,
                totalAmount: amount,
                side: "WN",
              });
            }
          }
        }

        // Process credit account (MA)
        if (transaction.credit_account) {
          const acc = transaction.credit_account;
          const syntheticNumber = getSyntheticAccountNumber(acc.number);
          const prefix = syntheticNumber.split("-")[0];
          const amount = transaction.credit_amount || transaction.amount || 0;

          // Only include 7xx (income) and 2xx accounts on credit side
          if (prefix.startsWith("7") || prefix.startsWith("2")) {
            const key = `${syntheticNumber}-MA`;
            const existing = accountMap.get(key);
            if (existing) {
              existing.totalAmount += amount;
            } else {
              const syntheticName = syntheticAccountsMap.get(syntheticNumber) || acc.name;
              accountMap.set(key, {
                accountNumber: syntheticNumber,
                accountName: syntheticName,
                totalAmount: amount,
                side: "MA",
              });
            }
          }
        }
      });

      // Convert map to array and filter out zero amounts
      const allAccounts = Array.from(accountMap.values())
        .filter((a) => Math.abs(a.totalAmount) > 0.01)
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

      // Separate income and expense accounts
      const incomeAccounts = allAccounts.filter((a) => {
        const prefix = a.accountNumber.split("-")[0];
        return (prefix.startsWith("7") && a.side === "MA") || (prefix.startsWith("2") && a.side === "MA");
      });

      const expenseAccounts = allAccounts.filter((a) => {
        const prefix = a.accountNumber.split("-")[0];
        return (prefix.startsWith("4") && a.side === "WN") || (prefix.startsWith("2") && a.side === "WN");
      });

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Single sheet with everything
      const sheetData: (string | number | null)[][] = [
        ["RAPORT FINANSOWY"],
        [""],
        ["Placówka:", locationName, "", ""],
        ["Okres:", period, "", ""],
        ["Rok:", year, "", ""],
        ["Miesiąc:", month, "", ""],
        [""],
        ["PODSUMOWANIE FINANSOWE"],
        [""],
        ["Bilans otwarcia:", reportDetails?.opening_balance || 0, "", ""],
        ["Przychody:", reportDetails?.income_total || 0, "", ""],
        ["Rozchody:", reportDetails?.expense_total || 0, "", ""],
        ["Rozliczenia:", reportDetails?.settlements_total || 0, "", ""],
        ["Bilans:", reportDetails?.balance || 0, "", ""],
        ["Bilans zamknięcia:", reportDetails?.closing_balance || 0, "", ""],
        [""],
        [""],
        ["ROZPISKA KONT - PRZYCHODY"],
        [""],
        ["Numer konta", "Nazwa konta", "Strona", "Kwota"],
        ...incomeAccounts.map((a) => [a.accountNumber, a.accountName, a.side, a.totalAmount]),
        ["SUMA PRZYCHODÓW", "", "", incomeAccounts.reduce((sum, a) => sum + a.totalAmount, 0)],
        [""],
        [""],
        ["ROZPISKA KONT - ROZCHODY"],
        [""],
        ["Numer konta", "Nazwa konta", "Strona", "Kwota"],
        ...expenseAccounts.map((a) => [a.accountNumber, a.accountName, a.side, a.totalAmount]),
        ["SUMA ROZCHODÓW", "", "", expenseAccounts.reduce((sum, a) => sum + a.totalAmount, 0)],
      ];

      const sheet = XLSX.utils.aoa_to_sheet(sheetData);
      sheet["!cols"] = [{ wch: 25 }, { wch: 45 }, { wch: 10 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, sheet, "Podsumowanie");

      // Generate filename
      const monthNames = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paz", "lis", "gru"];
      const filename = `raport_${locationName.replace(/\s+/g, "_")}_${monthNames[month - 1]}_${year}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success("Raport wyeksportowany do Excel z rozpiską kont");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Błąd eksportu: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return <Button variant="transparent"></Button>;
};

export default ExportToExcel;
