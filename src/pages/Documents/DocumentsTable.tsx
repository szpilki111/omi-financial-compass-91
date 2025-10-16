
import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

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
  total_amount?: number;
}

interface DocumentsTableProps {
  documents: Document[];
  onDocumentClick: (document: Document) => void;
  onDocumentDelete: (documentId: string) => void;
  isLoading: boolean;
}

const DocumentsTable: React.FC<DocumentsTableProps> = ({
  documents,
  onDocumentClick,
  onDocumentDelete,
  isLoading
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

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
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Brak dokumentów do wyświetlenia
        </h3>
        <p className="text-gray-600">
          Dodaj swój pierwszy dokument, aby rozpocząć
        </p>
      </div>
    );
  }

  const getCurrencySymbol = (currency: string = 'PLN') => {
    const currencySymbols: { [key: string]: string } = {
      'PLN': 'zł',
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'CZK': 'Kč',
      'NOK': 'kr',
      'SEK': 'kr',
    };
    return currencySymbols[currency] || currency;
  };

  const formatAmount = (amount: number, currency: string = 'PLN') => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toLocaleString('pl-PL', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })} ${symbol}`;
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numer dokumentu</TableHead>
            <TableHead>Nazwa</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-24">Liczba operacji</TableHead>
            <TableHead className="text-right">Suma</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const hasErrors = document.validation_errors && Array.isArray(document.validation_errors) && document.validation_errors.length > 0;
            // Count total missing fields instead of incomplete transactions
            let totalMissingFields = 0;
            if (hasErrors) {
              document.validation_errors.forEach((error: any) => {
                if (error.missingFields && typeof error.missingFields === 'object') {
                  totalMissingFields += Object.keys(error.missingFields).length;
                }
              });
            }
            
            return (
              <TableRow 
                key={document.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onDocumentClick(document)}
              >
                <TableCell className="font-medium">{document.document_number}</TableCell>
                <TableCell>{document.document_name}</TableCell>
                <TableCell>{format(new Date(document.document_date), 'dd.MM.yyyy')}</TableCell>
                <TableCell className="text-center w-24">{document.transaction_count || 0}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(document.total_amount || 0, document.currency)}
                </TableCell>
                <TableCell>
                  {hasErrors && totalMissingFields > 0 ? (
                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                      <AlertTriangle className="h-3 w-3" />
                      {totalMissingFields} {totalMissingFields === 1 ? 'puste pole' : 'pustych pól'}
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
                      title="Edytuj"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDocumentDelete(document.id);
                      }}
                      title="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default DocumentsTable;
