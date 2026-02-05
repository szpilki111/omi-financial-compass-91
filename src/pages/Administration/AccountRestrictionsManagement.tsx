import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useInvalidateFilteredAccounts } from "@/hooks/useFilteredAccounts";

// Category definitions based on location identifier prefix
const LOCATION_CATEGORIES = {
  "1": "Administracja prowincjalna",
  "2": "Dom zakonny",
  "3": "Parafia",
  "4": "Apostolat",
  "5": "Spółki, działalność gospodarcza",
};

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface AccountRestriction {
  id: string;
  account_number_prefix: string;
  category_prefix: string;
  is_restricted: boolean;
  analytical_required: boolean;
}

const AccountRestrictionsManagement = () => {
  const queryClient = useQueryClient();
  const invalidateFilteredAccounts = useInvalidateFilteredAccounts();

  // Fetch all accounts with pagination to ensure we get all 5000+ accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts-for-restrictions"],
    queryFn: async () => {
      let allAccounts: Account[] = [];
      let page = 0;
      const pageSize = 20;

      while (true) {
        const { data, error } = await supabase
          .from("accounts")
          .select("id, number, name, type")
          .order("number")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allAccounts = [...allAccounts, ...data];
        if (data.length < pageSize) break; // Last page
        page++;
      }

      console.log("Total accounts fetched:", allAccounts.length);
      return allAccounts as Account[];
    },
  });

  // Get unique account number prefixes (only first part before first hyphen)
  const uniqueAccountPrefixes = accounts
    ? [
        ...new Set(
          accounts.map((account) => {
            // Extract only the first part before the first hyphen
            const parts = account.number.split("-");
            return parts[0];
          }),
        ),
      ].sort()
    : [];

  // Fetch existing restrictions
  const { data: restrictions, isLoading: restrictionsLoading } = useQuery({
    queryKey: ["account-restrictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_category_restrictions").select("*");

      if (error) throw error;
      return data as AccountRestriction[];
    },
  });

  // Update restriction mutation
  const updateRestrictionMutation = useMutation({
    mutationFn: async ({
      accountPrefix,
      categoryPrefix,
      isRestricted,
      analyticalRequired,
    }: {
      accountPrefix: string;
      categoryPrefix: string;
      isRestricted?: boolean;
      analyticalRequired?: boolean;
    }) => {
      const { error } = await supabase.from("account_category_restrictions").upsert(
        {
          account_number_prefix: accountPrefix,
          category_prefix: categoryPrefix,
          ...(isRestricted !== undefined && { is_restricted: isRestricted }),
          ...(analyticalRequired !== undefined && { analytical_required: analyticalRequired }),
        },
        {
          onConflict: "account_number_prefix,category_prefix",
        },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-restrictions"] });
      // Invalidacja centralnego hooka kont - wszystkie komponenty natychmiast zobaczą zmianę
      invalidateFilteredAccounts();
      toast.success("Ograniczenie zostało zaktualizowane");
    },
    onError: (error) => {
      console.error("Error updating restriction:", error);
      toast.error("Błąd podczas aktualizacji ograniczenia");
    },
  });

  const handleRestrictionChange = (accountPrefix: string, categoryPrefix: string, isRestricted: boolean) => {
    updateRestrictionMutation.mutate({ accountPrefix, categoryPrefix, isRestricted });
  };

  const handleAnalyticalChange = (accountPrefix: string, analyticalRequired: boolean) => {
    updateRestrictionMutation.mutate({ accountPrefix, categoryPrefix: "analytical", analyticalRequired });
  };

  const isRestricted = (accountPrefix: string, categoryPrefix: string): boolean => {
    const restriction = restrictions?.find(
      (r) => r.account_number_prefix === accountPrefix && r.category_prefix === categoryPrefix,
    );
    return restriction?.is_restricted || false;
  };

  const isAnalyticalRequired = (accountPrefix: string): boolean => {
    const restriction = restrictions?.find(
      (r) => r.account_number_prefix === accountPrefix && r.category_prefix === "analytical",
    );
    return restriction?.analytical_required || false;
  };

  if (accountsLoading || restrictionsLoading) {
    return <div>Ładowanie...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zarządzanie ograniczeniami dostępu do kont</CardTitle>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Zaznacz checkbox aby ograniczyć dostęp do konta dla placówek z danej kategorii. Kategorie są określane na
              podstawie pierwszej części identyfikatora placówki. W kolumnie "Analityka obowiązkowa" można oznaczyć
              które konta wymagają obowiązkowego tworzenia podkont analitycznych.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer konta (bez identyfikatora)</TableHead>
                  {Object.entries(LOCATION_CATEGORIES).map(([prefix, name]) => (
                    <TableHead key={prefix} className="text-center min-w-[150px]">
                      {name}
                      <br />
                      <span className="text-xs text-muted-foreground">({prefix}-*)</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[150px]">
                    Czy konto analityczne?
                    <br />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueAccountPrefixes.map((accountPrefix) => (
                  <TableRow key={accountPrefix}>
                    <TableCell className="font-medium">{accountPrefix}</TableCell>
                    {Object.keys(LOCATION_CATEGORIES).map((categoryPrefix) => (
                      <TableCell key={categoryPrefix} className="text-center">
                        <Checkbox
                          checked={isRestricted(accountPrefix, categoryPrefix)}
                          onCheckedChange={(checked) =>
                            handleRestrictionChange(accountPrefix, categoryPrefix, !!checked)
                          }
                          disabled={updateRestrictionMutation.isPending}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isAnalyticalRequired(accountPrefix)}
                        onCheckedChange={(checked) => handleAnalyticalChange(accountPrefix, !!checked)}
                        disabled={updateRestrictionMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legenda kategorii placówek</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(LOCATION_CATEGORIES).map(([prefix, name]) => (
              <div key={prefix} className="flex items-center space-x-2">
                <span className="font-medium">{prefix}:</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountRestrictionsManagement;
