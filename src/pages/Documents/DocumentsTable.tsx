import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, AlertTriangle, Lock, Copy, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Document {
  id: string;
  document_number: string;
  document_name: string;
  document_date: string;
  location_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  currency: string;
  validation_errors?: any;
  locations?: {
    name: string;
  } | null;
  profiles?: {
    name: string;
  } | null;
  transaction_count?: number;
  location_name_snapshot?: string | null;
  total_amount?: number;
}

interface DocumentsTableProps {
  documents: Document[];
  onDocumentClick: (document: Document) => void;
  onDocumentDelete: (documentId: string, documentDate?: string, locationId?: string) => void;
  onDocumentDuplicate: (documentId: string) => void;
  isLoading: boolean;
  showLocation?: boolean;
}

const DocumentsTable: React.FC<DocumentsTableProps> = ({ documents, onDocumentClick, onDocumentDelete, onDocumentDuplicate, isLoading, showLocation = false }) => {
  const { user, isReadOnly } = useAuth();
  const isAdmin = user?.role === "prowincjal" || user?.role === "admin";

  type SortKey = "document_number" | "document_name" | "location" | "document_date" | "transaction_count" | "total_amount";
  const [sortKey, setSortKey] = React.useState<SortKey>("document_number");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedDocuments = React.useMemo(() => {
    if (!documents) return [];
    const getSortValue = (doc: Document): string | number => {
      switch (sortKey) {
        case "transaction_count":
          return doc.transaction_count || 0;
        case "total_amount":
          return doc.total_amount || 0;
        case "location":
          return doc.location_name_snapshot || doc.locations?.name || "";
        default:
          return (doc[sortKey] as string) ?? "";
      }
    };
    const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });
    const arr = [...documents];
    arr.sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      let res: number;
      if (typeof va === "number" && typeof vb === "number") {
        res = va - vb;
      } else {
        res = collator.compare(String(va), String(vb));
      }
      return sortDir === "asc" ? res : -res;
    });
    return arr;
  }, [documents, sortKey, sortDir]);

  const renderSortableHeader = (key: SortKey, label: string, className?: string) => {
    const isSorted = sortKey === key;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => handleSort(key)}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          title="Kliknij, aby posortować"
        >
          {label}
          {isSorted ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </TableHead>
    );
  };

  const isDocumentLocked = (doc: Document): boolean => {
    if (!doc.validation_errors || !Array.isArray(doc.validation_errors)) return false;
    return doc.validation_errors.some((error: any) => error.type === "locked_by_report");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Brak dokumentów do wyświetlenia</h3>
        <p className="text-gray-600">Dodaj swój pierwszy dokument, aby rozpocząć</p>
      </div>
    );
  }

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

  const formatAmount = (amount: number, currency: string = "PLN") => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${symbol}`;
  };

  return (
    <TooltipProvider>
      <div className="bg-white shadow rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {renderSortableHeader("document_number", "Numer dokumentu")}
              {renderSortableHeader("document_name", "Nazwa")}
              {showLocation && renderSortableHeader("location", "Placówka")}
              {renderSortableHeader("document_date", "Data")}
              {renderSortableHeader("transaction_count", "Liczba operacji", "w-24")}
              {renderSortableHeader("total_amount", "Suma", "text-right")}
              <TableHead>Status</TableHead>
              <TableHead>Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDocuments.map((document) => {
              const locked = isDocumentLocked(document);
              const hasErrors =
                document.validation_errors &&
                Array.isArray(document.validation_errors) &&
                document.validation_errors.filter((e: any) => e.type !== "locked_by_report").length > 0;

              // Count total missing fields including import errors
              let totalMissingFields = 0;
              let hasMissingAccountsError = false;
              if (hasErrors) {
                document.validation_errors
                  .filter((error: any) => error.type !== "locked_by_report")
                  .forEach((error: any) => {
                    if (error.missingFields && typeof error.missingFields === "object") {
                      totalMissingFields += Object.keys(error.missingFields).length;
                    }
                    // Obsłuż błędy z importu MT940/CSV
                    if (error.type === "missing_accounts") {
                      hasMissingAccountsError = true;
                      // Wyciągnij liczbę z message, np. "5 operacji wymaga uzupełnienia kont"
                      const match = error.message?.match(/^(\d+)/);
                      if (match) {
                        totalMissingFields += parseInt(match[1], 10);
                      } else {
                        totalMissingFields += 1;
                      }
                    }
                  });
              }

              return (
                <TableRow
                  key={document.id}
                  className={`hover:bg-gray-50 cursor-pointer ${locked ? "opacity-75 bg-gray-50" : ""}`}
                  onClick={() => onDocumentClick(document)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {locked && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Dokument zablokowany - raport zatwierdzony</TooltipContent>
                        </Tooltip>
                      )}
                      {document.document_number}
                    </div>
                  </TableCell>
                  <TableCell>{document.document_name}</TableCell>
                  {showLocation && (
                    <TableCell className="text-sm text-muted-foreground">
                      {document.location_name_snapshot || document.locations?.name || "—"}
                    </TableCell>
                  )}
                  <TableCell>{format(new Date(document.document_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="text-center w-24">{document.transaction_count || 0}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(document.total_amount || 0, document.currency)}
                  </TableCell>
                  <TableCell>
                    {locked ? (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <Lock className="h-3 w-3" />
                        Zablokowany
                      </Badge>
                    ) : hasErrors && totalMissingFields > 0 ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" />
                        {hasMissingAccountsError
                          ? `${totalMissingFields} ${totalMissingFields === 1 ? "brak konta" : "brak kont"}`
                          : `${totalMissingFields} ${totalMissingFields === 1 ? "puste pole" : "pustych pól"}`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDocumentClick(document);
                        }}
                        title={locked || isReadOnly ? "Podgląd (tylko do odczytu)" : "Edytuj"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!isReadOnly && <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDocumentDuplicate(document.id);
                        }}
                        title="Kopiuj dokument (utworzy nowy z dzisiejszą datą)"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>}
                      {!locked && !isReadOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDocumentDelete(document.id, document.document_date, document.location_id);
                          }}
                          title="Usuń"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default DocumentsTable;
