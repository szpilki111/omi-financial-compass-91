
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Calendar, MapPin, Edit, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Operation {
  id: string;
  document_id: string | null;
  account_number: string;
  description: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  date: string;
  location: { name: string } | null;
  document: {
    document_number: string;
    type: string;
  } | null;
}

interface OperationDetailsDialogProps {
  operation: Operation | null;
  isOpen: boolean;
  onClose: () => void;
}

const OperationDetailsDialog = ({ operation, isOpen, onClose }: OperationDetailsDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const handleEditDocument = async () => {
    if (!operation?.document_id) {
      toast({
        title: "Błąd",
        description: "Brak identyfikatora dokumentu",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Pobierz szczegóły dokumentu
      const { data: document, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', operation.document_id)
        .single();

      if (error) throw error;

      // Otwórz stronę dokumentów z parametrem edycji
      const editUrl = `/dokumenty?edit=${operation.document_id}`;
      window.open(editUrl, '_blank');
      
      toast({
        title: "Przekierowanie",
        description: "Otwarto dokument w nowej karcie do edycji",
      });
    } catch (error: any) {
      console.error('Error fetching document:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się otworzyć dokumentu do edycji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!operation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Szczegóły operacji
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Operation Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={operation.transaction_type === 'income' ? 'default' : 'destructive'}>
                    {operation.transaction_type === 'income' ? 'Przychód' : 'Rozchód'}
                  </Badge>
                  <span className="text-lg">
                    {operation.transaction_type === 'income' ? '+' : '-'}{formatCurrency(operation.amount)}
                  </span>
                </div>
                {operation.document_id && (
                  <Button
                    onClick={handleEditDocument}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edytuj dokument
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Opis operacji:</label>
                  <p className="text-gray-900">{operation.description}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data operacji:</label>
                    <p className="flex items-center gap-1 text-gray-900">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(operation.date), 'dd MMMM yyyy', { locale: pl })}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Lokalizacja:</label>
                    <p className="flex items-center gap-1 text-gray-900">
                      <MapPin className="h-4 w-4" />
                      {operation.location?.name || 'Brak lokalizacji'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Numer konta:</label>
                  <p className="font-mono text-gray-900">{operation.account_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Information */}
          {operation.document_id && (
            <Card>
              <CardHeader>
                <CardTitle>Informacje o dokumencie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Numer dokumentu:</label>
                      <p className="text-gray-900">{operation.document?.document_number || 'Brak numeru'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Typ dokumentu:</label>
                      <p className="text-gray-900">{operation.document?.type || 'Nieznany'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">ID dokumentu:</label>
                    <p className="font-mono text-xs text-gray-500">{operation.document_id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Dodatkowe informacje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">ID operacji:</label>
                  <p className="font-mono text-xs text-gray-500">{operation.id}</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Wskazówka:</strong> {operation.document_id ? 'Kliknij "Edytuj dokument" aby przejść do szczegółowej edycji całego dokumentu finansowego wraz z wszystkimi powiązanymi operacjami w nowej karcie.' : 'Ta operacja nie jest powiązana z żadnym dokumentem.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OperationDetailsDialog;
