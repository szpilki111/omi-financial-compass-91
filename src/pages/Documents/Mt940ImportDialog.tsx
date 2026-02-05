import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { Upload, FileText } from "lucide-react";

interface Mt940Transaction {
  date: string;
  amount: number;
  type: "C" | "D";
  description: string;
  reference: string;
  accountNumber?: string;
  counterparty?: string;
}

interface Mt940Data {
  accountNumber: string;
  statementNumber: string;
  openingBalance: number;
  closingBalance: number;
  transactions: Mt940Transaction[];
}

interface Mt940ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
  variant?: "pko" | "other";
}

const Mt940ImportDialog: React.FC<Mt940ImportDialogProps> = ({
  open,
  onClose,
  onImportComplete,
  variant = "other",
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Mt940Data | null>(null);
  const [documentDate, setDocumentDate] = useState<Date>(new Date());

  const { user } = useAuth();
  const { toast } = useToast();

  const extractDescription = (detailsLine: string): string => {
    let description = "Operacja bankowa";

    if (!detailsLine) return description;

    const useTilde = detailsLine.includes("~");
    const separator = useTilde ? "~" : "^";

    if (!detailsLine.includes(separator)) {
      return description;
    }

    const parts = detailsLine.split(new RegExp(`(?=${separator}[0-9]{2})`));
    let descParts: string[] = [];

    for (const part of parts) {
      const match = part.match(new RegExp(`^${useTilde ? "~" : "\\^"}(2[0-5])(.*)`, "s"));
      if (match) {
        const content = match[2].trim();
        if (content && content !== "ÿ" && content.charCodeAt(0) !== 255) {
          descParts.push(content);
        }
      }
    }

    if (descParts.length > 0) {
      description = descParts.join(" ").replace(/\s+/g, " ").trim();
    }

    return description;
  };

  const extractCounterparty = (detailsLine: string): { name: string; account: string } => {
    if (!detailsLine) return { name: "", account: "" };

    const useTilde = detailsLine.includes("~");
    const separator = useTilde ? "~" : "^";

    const parts = detailsLine.split(new RegExp(`(?=${separator}[0-9]{2})`));

    let counterparty = "";
    let accountNumber = "";

    for (const part of parts) {
      const fieldMatch = part.match(new RegExp(`^${useTilde ? "~" : "\\^"}([0-9]{2})(.*)`));
      if (!fieldMatch) continue;

      const fieldNum = fieldMatch[1];
      const content = fieldMatch[2].trim();

      if (!content || content === "ÿ" || content.charCodeAt(0) === 255) continue;

      if (fieldNum === "32" || fieldNum === "33") {
        counterparty += (counterparty ? " " : "") + content;
      } else if (fieldNum === "38") {
        accountNumber = content;
      }
    }

    return { name: counterparty.trim(), account: accountNumber.trim() };
  };

  const parseMt940File = (content: string): Mt940Data => {
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let accountNumber = "";
    let statementNumber = "";
    let openingBalance = 0;
    let closingBalance = 0;
    const transactions: Mt940Transaction[] = [];

    let currentTransaction: Partial<Mt940Transaction> = {};
    let currentDetails = "";
    let inDetailsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith(":25:")) {
        accountNumber = line.substring(4).replace("/", "").trim();
      } else if (line.startsWith(":28C:")) {
        statementNumber = line.substring(5).trim();
      } else if (line.startsWith(":60F:")) {
        const val = line.substring(13).replace(",", ".");
        openingBalance = parseFloat(val) || 0;
      } else if (line.startsWith(":62F:")) {
        const val = line.substring(13).replace(",", ".");
        closingBalance = parseFloat(val) || 0;
      } else if (line.startsWith(":61:")) {
        // Zapisujemy poprzednią transakcję – ZAWSZE przed rozpoczęciem nowej
        if (currentTransaction.date && currentTransaction.amount !== undefined) {
          if (currentDetails.trim()) {
            currentTransaction.description = extractDescription(currentDetails);
            const cp = extractCounterparty(currentDetails);
            currentTransaction.counterparty = cp.name;
            currentTransaction.accountNumber = cp.account;
          }
          transactions.push(currentTransaction as Mt940Transaction);
        }

        // Reset
        currentTransaction = {};
        currentDetails = "";
        inDetailsSection = false;

        const txLine = line.substring(4).trim();

        // Data
        const dateStr = txLine.substring(0, 6);
        const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
        const month = parseInt(dateStr.substring(2, 4), 10);
        const day = parseInt(dateStr.substring(4, 6), 10);
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // Typ
        const typeMatch = txLine.match(/([CD])(N?)/);
        const type = (typeMatch?.[1] as "C" | "D") || "D";

        // Kwota – najbardziej uniwersalna wersja
        const amountMatch = txLine.match(/[CD]N?(\d{1,15}[.,]\d{1,4})/);
        const amountStr = amountMatch?.[1]?.replace(",", ".") || "0";
        const amount = parseFloat(amountStr) || 0;

        // Reference (opcjonalne)
        const refMatch = txLine.match(/\/\/([^/]+)$/);
        const reference = refMatch ? refMatch[1].trim() : "";

        currentTransaction = {
          date,
          amount,
          type,
          reference,
          description: "Operacja bankowa",
          counterparty: "",
          accountNumber: "",
        };
      } else if (line.startsWith(":86:")) {
        // Rozpoczęcie / nadpisywanie nowego pola :86:
        inDetailsSection = true;
        currentDetails = line.substring(4).trim();
      } else if (inDetailsSection && !line.startsWith(":")) {
        // Kontynuacja (rzadkie w formacie ^, ale obsługujemy)
        currentDetails += " " + line;
      } else if (inDetailsSection && line.startsWith(":")) {
        // Koniec poprzedniego :86: → zapisujemy detale
        if (currentTransaction.date && currentDetails.trim()) {
          currentTransaction.description = extractDescription(currentDetails);
          const cp = extractCounterparty(currentDetails);
          currentTransaction.counterparty = cp.name;
          currentTransaction.accountNumber = cp.account;
        }

        inDetailsSection = false;
        currentDetails = "";

        // Jeśli nowa linia to też :86: (rzadkie)
        if (line.startsWith(":86:")) {
          inDetailsSection = true;
          currentDetails = line.substring(4).trim();
        }
      }
    }

    // Ostatnia transakcja
    if (currentTransaction.date && currentTransaction.amount !== undefined) {
      if (currentDetails.trim()) {
        currentTransaction.description = extractDescription(currentDetails);
        const cp = extractCounterparty(currentDetails);
        currentTransaction.counterparty = cp.name;
        currentTransaction.accountNumber = cp.account;
      }
      transactions.push(currentTransaction as Mt940Transaction);
    }

    return {
      accountNumber,
      statementNumber,
      openingBalance,
      closingBalance,
      transactions,
    };
  };

  // ────────────────────────────────────────────────────────────────
  // Pozostała część kodu (encoding, handleFileChange, handleImport, UI)
  // pozostaje bez zmian – wklejam tylko kluczowe fragmenty dla kompletności
  // ────────────────────────────────────────────────────────────────

  // ... tutaj wklej cały kod funkcji detectAndConvertEncoding, convertWithMap, cp852ToUtf8Map, mazoviaToUtf8Map ...
  // (pozostawiam je bez zmian, bo nie były przyczyną problemu z opisami)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    try {
      const content = await detectAndConvertEncoding(selectedFile);
      const parsedData = parseMt940File(content);
      setPreviewData(parsedData);
    } catch (error) {
      console.error("Error parsing MT940:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się przetworzyć pliku MT940",
        variant: "destructive",
      });
    }
  };

  // ... handleImport, formatAmount, return (JSX) – bez zmian ...

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* reszta JSX bez zmian */}
    </Dialog>
  );
};

export default Mt940ImportDialog;
