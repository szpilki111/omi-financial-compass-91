
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpirTransaction } from "@/types/kpir";

/**
 * Hook do pobierania wszystkich operacji (transakcji) przypisanych do konkretnego dokumentu.
 */
export function useDocumentTransactions(documentId: string | null) {
  return useQuery({
    queryKey: ["document-transactions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          debitAccount:accounts!debit_account_id(number, name),
          creditAccount:accounts!credit_account_id(number, name),
          location:locations(name)
        `
        )
        .eq("document_id", documentId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        // Zwróć błąd, zostanie przechwycony przez React Query
        throw error;
      }

      // Mapowanie do KpirTransaction z polami pomocniczymi
      return (data || []).map((transaction: any) => ({
        id: transaction.id,
        date: transaction.date,
        formattedDate: new Date(transaction.date).toLocaleDateString("pl-PL"),
        document_number: transaction.document_number,
        description: transaction.description,
        amount: parseFloat(transaction.amount.toString()),
        debit_account_id: transaction.debit_account_id,
        credit_account_id: transaction.credit_account_id,
        debitAccount: transaction.debitAccount,
        creditAccount: transaction.creditAccount,
        settlement_type: transaction.settlement_type as KpirTransaction["settlement_type"],
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate ? parseFloat(transaction.exchange_rate.toString()) : undefined,
        location: transaction.location,
        user_id: transaction.user_id,
        location_id: transaction.location_id,
        parent_transaction_id: transaction.parent_transaction_id,
        is_split_transaction: transaction.is_split_transaction || false,
        document: null, // w kontekście tej tabeli nie potrzebujemy zagnieżdżonego dokumentu
      }));
    },
  });
}
