import React from "react";
import { getFirstDayOfMonth, getLastDayOfMonth } from "@/utils/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";

interface AccountBreakdown {
  account_number: string;
  account_name: string;
  account_type: string;
  total_amount: number;
  category: "income" | "expense" | "other";
  side: "debit" | "credit";
}

interface ReportAccountsBreakdownProps {
  reportId: string;
  locationId: string;
  month: number;
  year: number;
  dateRange?: {
    from: string;
    to: string;
  };
}

const ReportAccountsBreakdown: React.FC<ReportAccountsBreakdownProps> = ({
  reportId,
  locationId,
  month,
  year,
  dateRange,
}) => {
  const { user } = useAuth();

  // Fetch location category and restrictions
  const { data: restrictionData } = useQuery({
    queryKey: ["account-restrictions-for-reports", locationId],
    queryFn: async () => {
      // Get location identifier
      const { data: locationData, error: locationError } = await supabase
        .from("locations")
        .select("location_identifier")
        .eq("id", locationId)
        .single();

      if (locationError) {
        console.error("Error fetching location:", locationError);
        return { restrictedPrefixes: [] };
      }

      const locationCategory = locationData?.location_identifier?.split("-")[0];

      if (!locationCategory) {
        return { restrictedPrefixes: [] };
      }

      // Get restrictions for this category
      const { data: restrictionsData, error: restrictionsError } = await supabase
        .from("account_category_restrictions")
        .select("account_number_prefix")
        .eq("category_prefix", locationCategory)
        .eq("is_restricted", true);

      if (restrictionsError) {
        console.error("Error fetching restrictions:", restrictionsError);
        return { restrictedPrefixes: [] };
      }

      return {
        restrictedPrefixes: restrictionsData?.map((r) => r.account_number_prefix) || [],
      };
    },
    enabled: !!locationId,
  });

  // Pobieranie szczegółowej rozpiski kont dla raportu
  const { data: accountsBreakdown, isLoading } = useQuery({
    queryKey: [
      "report_accounts_breakdown",
      reportId,
      locationId,
      month,
      year,
      dateRange,
      restrictionData?.restrictedPrefixes,
    ],
    queryFn: async () => {
      let dateFrom: string;
      let dateTo: string;

      // Jeśli podano niestandardowy zakres dat, użyj go
      if (dateRange) {
        dateFrom = dateRange.from;
        dateTo = dateRange.to;
      } else {
        // W przeciwnym razie oblicz daty na podstawie miesiąca i roku
        dateFrom = getFirstDayOfMonth(year, month);
        dateTo = getLastDayOfMonth(year, month);
      }

      // Pobierz wszystkie transakcje dla danej lokalizacji w okresie
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(
          `
          amount,
          debit_account_id,
          credit_account_id,
          debit_amount,
          credit_amount,
          description,
          document_number,
          debit_account:accounts!debit_account_id(number, name, type),
          credit_account:accounts!credit_account_id(number, name, type)
        `,
        )
        .eq("location_id", locationId)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      if (error) throw error;

      const restrictedPrefixes = restrictionData?.restrictedPrefixes || [];

      // Funkcja do sprawdzania czy konto jest ograniczone
      const isAccountRestricted = (accountNumber: string) => {
        if (!accountNumber || restrictedPrefixes.length === 0) return false;
        const accountPrefix = accountNumber.split("-")[0];
        return restrictedPrefixes.includes(accountPrefix);
      };

      // Funkcja do wyodrębnienia numeru konta syntetycznego (max 3 segmenty)
      const getSyntheticAccountNumber = (accountNumber: string): string => {
        if (!accountNumber) return accountNumber;
        const segments = accountNumber.split("-");
        if (segments.length <= 3) {
          return accountNumber; // już jest syntetyczne
        }
        return segments.slice(0, 3).join("-"); // np. "110-2-3-1" → "110-2-3"
      };

      // Funkcja do sprawdzania czy konto należy do kategorii przychodów/kosztów
      // UWAGA: Konta 200 są teraz w kategorii należności/zobowiązań, nie w przychodach/kosztach
      const isRelevantAccount = (accountNumber: string) => {
        if (!accountNumber) return false;
        // Skip restricted accounts
        if (isAccountRestricted(accountNumber)) return false;
        // Konta 200 nie są już liczone do przychodów/kosztów
        if (accountNumber.startsWith("200")) return false;
        return accountNumber.startsWith("2") || accountNumber.startsWith("4") || accountNumber.startsWith("7");
      };

      // Zbierz unikalne numery kont syntetycznych do pobrania nazw
      const syntheticNumbersSet = new Set<string>();

      transactions?.forEach((transaction) => {
        const { debit_account, credit_account } = transaction;
        if (debit_account && isRelevantAccount(debit_account.number)) {
          syntheticNumbersSet.add(getSyntheticAccountNumber(debit_account.number));
        }
        if (credit_account && isRelevantAccount(credit_account.number)) {
          syntheticNumbersSet.add(getSyntheticAccountNumber(credit_account.number));
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

      // Zgrupuj transakcje według kont SYNTETYCZNYCH i oblicz sumy
      const accountTotals = new Map<string, AccountBreakdown>();

      transactions?.forEach((transaction) => {
        const { amount, debit_account, credit_account, debit_amount, credit_amount } = transaction;

        // Dla konta debetowego - sprawdź czy to konto 2xx, 4xx lub 7xx i nie jest ograniczone
        if (debit_account && isRelevantAccount(debit_account.number)) {
          const syntheticNumber = getSyntheticAccountNumber(debit_account.number);
          const key = `${syntheticNumber}_debit`;
          const existing = accountTotals.get(key);

          // Użyj debit_amount jeśli jest dostępne, w przeciwnym razie amount
          const transactionAmount = debit_amount && debit_amount > 0 ? debit_amount : Number(amount);

          if (existing) {
            existing.total_amount += transactionAmount;
          } else {
            // Użyj nazwy konta syntetycznego z bazy lub nazwy oryginalnego konta
            const syntheticName = syntheticAccountsMap.get(syntheticNumber) || debit_account.name;

            accountTotals.set(key, {
              account_number: syntheticNumber,
              account_name: syntheticName,
              account_type: debit_account.type,
              total_amount: transactionAmount,
              category: categorizeAccount(syntheticNumber, "debit"),
              side: "debit",
            });
          }
        }

        // Dla konta kredytowego - sprawdź czy to konto 2xx, 4xx lub 7xx i nie jest ograniczone
        if (credit_account && isRelevantAccount(credit_account.number)) {
          const syntheticNumber = getSyntheticAccountNumber(credit_account.number);
          const key = `${syntheticNumber}_credit`;
          const existing = accountTotals.get(key);

          // Użyj credit_amount jeśli jest dostępne, w przeciwnym razie amount
          const transactionAmount = credit_amount && credit_amount > 0 ? credit_amount : Number(amount);

          if (existing) {
            existing.total_amount += transactionAmount;
          } else {
            // Użyj nazwy konta syntetycznego z bazy lub nazwy oryginalnego konta
            const syntheticName = syntheticAccountsMap.get(syntheticNumber) || credit_account.name;

            accountTotals.set(key, {
              account_number: syntheticNumber,
              account_name: syntheticName,
              account_type: credit_account.type,
              total_amount: transactionAmount,
              category: categorizeAccount(syntheticNumber, "credit"),
              side: "credit",
            });
          }
        }
      });

      // Konwertuj mapę na tablicę i posortuj
      const breakdown = Array.from(accountTotals.values())
        .filter((account) => {
          // Filtruj tylko konta, które rzeczywiście wpływają na przychody/koszty
          return account.category === "income" || account.category === "expense";
        })
        .filter((account) => Math.abs(account.total_amount) > 0.01) // Filtruj konta z zerowym saldem
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      return breakdown;
    },
    enabled: !!locationId && restrictionData !== undefined,
  });

  // Funkcja do kategoryzacji kont - TYLKO konta wpływające na przychody/koszty
  const categorizeAccount = (accountNumber: string, side: "debit" | "credit"): "income" | "expense" | "other" => {
    if (!accountNumber) return "other";

    // Przychody: konta 7xx po stronie kredytowej ORAZ konta 2xx po stronie kredytowej
    if ((accountNumber.startsWith("7") && side === "credit") || (accountNumber.startsWith("2") && side === "credit")) {
      return "income";
    }

    // Koszty: konta 4xx po stronie debetowej ORAZ konta 2xx po stronie debetowej
    if ((accountNumber.startsWith("4") && side === "debit") || (accountNumber.startsWith("2") && side === "debit")) {
      return "expense";
    }

    return "other";
  };

  // Formatowanie wartości walutowych
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
  };

  // Grupowanie kont według kategorii
  const groupedAccounts = accountsBreakdown?.reduce(
    (groups, account) => {
      const category = account.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(account);
      return groups;
    },
    {} as Record<string, AccountBreakdown[]>,
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {dateRange
              ? `Szczegółowa rozpiska kont (${dateRange.from} - ${dateRange.to})`
              : "Szczegółowa rozpiska kont"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <Spinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "income":
        return "📈 Przychody (konta 7xx i 2xx po stronie MA)";
      case "expense":
        return "📉 Koszty (konta 4xx i 2xx po stronie WN)";
      default:
        return "📊 Pozostałe";
    }
  };

  const getCategoryTotal = (accounts: AccountBreakdown[]) => {
    return accounts.reduce((sum, account) => sum + account.total_amount, 0);
  };

  return <Card></Card>;
};

export default ReportAccountsBreakdown;
