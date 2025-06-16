
import React from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FileText, Calendar, MapPin, Eye, Trash } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface Document {
  id: string;
  document_number: string;
  document_name: string;
  document_date: string;
  location_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  locations?: {
    name: string;
  } | null;
  profiles?: {
    name: string;
  } | null;
  transaction_count?: number;
}

interface DocumentTableProps {
  documents: Document[];
  onDocumentClick: (document: Document) => void;
  onDocumentDelete: (documentId: string) => void;
  isLoading: boolean;
}

const DocumentTable = ({ documents, onDocumentClick, onDocumentDelete, isLoading }: DocumentTableProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Brak dokumentów
        </h3>
        <p className="text-gray-600 mb-4">
          Utwórz pierwszy dokument, aby rozpocząć
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numer dokumentu</TableHead>
            <TableHead>Nazwa</TableHead>
            <TableHead>Data dokumentu</TableHead>
            <TableHead>Lokalizacja</TableHead>
            <TableHead>Transakcje</TableHead>
            <TableHead>Data utworzenia</TableHead>
            <TableHead className="w-[140px]">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id} className="cursor-pointer hover:bg-gray-50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  {document.document_number}
                </div>
              </TableCell>
              <TableCell>{document.document_name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  {format(new Date(document.document_date), 'dd MMMM yyyy', { locale: pl })}
                </div>
              </TableCell>
              <TableCell>
                {document.locations && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    {document.locations.name}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {document.transaction_count || 0}
                </span>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {format(new Date(document.created_at), 'dd.MM.yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDocumentClick(document);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDocumentDelete(document.id);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DocumentTable;
