
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from './types';
import DocumentTable from './DocumentTable';
import TransactionForm from './TransactionForm';
import TransactionEditDialog from './TransactionEditDialog';
import TransactionSplitDialog from './TransactionSplitDialog';
import ConfirmCloseDialog from './ConfirmCloseDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface Document {
  id: string;
  document_number: string;
  document_name: string;
  document_date: string;
  location_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface DocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: () => void;
  document?: Document | null;
}

const DocumentDialog: React.FC<DocumentDialogProps> = ({
  isOpen,
  onClose,
  onDocumentCreated,
  document,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    document_number: '',
    document_name: '',
    document_date: format(new Date(), 'yyyy-MM-dd'),
  });

  // Get user's location from profile
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('location_id')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if editing is blocked for this document
  const { data: isEditingBlocked, isLoading: checkingBlock } = useQuery({
    queryKey: ['editingBlocked', document?.id, userProfile?.location_id, formData.document_date],
    queryFn: async () => {
      if (!userProfile?.location_id) return false;
      
      // Use document date if editing existing document, otherwise use form date
      const dateToCheck = document?.document_date || formData.document_date;
      
      const { data, error } = await supabase.rpc('check_report_editing_blocked', {
        p_location_id: userProfile.location_id,
        p_document_date: dateToCheck
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.location_id && isOpen,
  });

  useEffect(() => {
    if (document) {
      setFormData({
        document_number: document.document_number,
        document_name: document.document_name,
        document_date: document.document_date,
      });
    } else {
      setFormData({
        document_number: '',
        document_name: '',
        document_date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
    setHasUnsavedChanges(false);
  }, [document, isOpen]);

  const fetchTransactions = async (documentId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('document_id', documentId);

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return data;
  };

  const { data: transactions } = useQuery({
    queryKey: ['transactions', document?.id],
    queryFn: () => fetchTransactions(document!.id),
    enabled: !!document?.id,
  });

  const handleSaveDocument = async () => {
    if (isEditingBlocked) return;
    
    setIsLoading(true);

    try {
      if (document) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            document_number: formData.document_number,
            document_name: formData.document_name,
            document_date: formData.document_date,
          })
          .eq('id', document.id);

        if (error) {
          console.error('Error updating document:', error);
          throw error;
        }

        toast({
          title: "Sukces",
          description: "Dokument został zaktualizowany pomyślnie",
        });
      } else {
        // Create new document
        const { data, error } = await supabase
          .from('documents')
          .insert({
            document_number: formData.document_number,
            document_name: formData.document_name,
            document_date: formData.document_date,
            location_id: userProfile?.location_id,
            user_id: user?.id,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating document:', error);
          throw error;
        }

        toast({
          title: "Sukces",
          description: "Dokument został utworzony pomyślnie",
        });
        
        // Invalidate documents query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['documents'] });

        // Call the callback to signal document creation
        onDocumentCreated();
      }

      setHasUnsavedChanges(false);
      onClose();
    } catch (error: any) {
      console.error('Error saving document:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać dokumentu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionDelete = async (transactionId: string) => {
    if (isEditingBlocked) {
      toast({
        title: "Błąd",
        description: "Nie można usuwać operacji - raport za ten okres został już złożony lub zatwierdzony",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Czy na pewno chcesz usunąć tę operację?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

      if (error) {
        console.error('Error deleting transaction:', error);
        throw error;
      }

      toast({
        title: "Sukces",
        description: "Operacja została usunięta pomyślnie",
      });

      // Refresh transactions list
      queryClient.invalidateQueries({ queryKey: ['transactions', document?.id] });
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć operacji",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !isEditingBlocked) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const handleDiscardChanges = () => {
    setShowConfirmDialog(false);
    onClose();
  };

  const handleConfirmSave = () => {
    setShowConfirmDialog(false);
    handleSaveDocument();
  };

  const handleTransactionAdded = (transaction: Transaction) => {
    queryClient.invalidateQueries({ queryKey: ['transactions', document?.id] });
  };

  if (checkingBlock) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sprawdzanie uprawnień...</DialogTitle>
          </DialogHeader>
          <div className="py-4">Sprawdzanie czy dokument może być edytowany...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {document ? 'Edytuj dokument' : 'Nowy dokument'}
          </DialogTitle>
        </DialogHeader>

        {isEditingBlocked && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {document 
                ? "Nie można edytować tego dokumentu, ponieważ raport za ten okres został już złożony lub zatwierdzony."
                : "Nie można tworzyć dokumentów na tę datę, ponieważ raport za ten okres został już złożony lub zatwierdzony."
              }
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Document form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="document_number">Numer dokumentu *</Label>
              <Input
                id="document_number"
                value={formData.document_number}
                onChange={(e) => {
                  if (!isEditingBlocked) {
                    setFormData({ ...formData, document_number: e.target.value });
                    setHasUnsavedChanges(true);
                  }
                }}
                placeholder="Zostanie wygenerowany automatycznie"
                disabled={isEditingBlocked}
              />
            </div>

            <div>
              <Label htmlFor="document_name">Nazwa dokumentu *</Label>
              <Input
                id="document_name"
                value={formData.document_name}
                onChange={(e) => {
                  if (!isEditingBlocked) {
                    setFormData({ ...formData, document_name: e.target.value });
                    setHasUnsavedChanges(true);
                  }
                }}
                placeholder="Np. Faktura sprzedaży"
                disabled={isEditingBlocked}
              />
            </div>

            <div>
              <Label htmlFor="document_date">Data dokumentu *</Label>
              <Input
                id="document_date"
                type="date"
                value={formData.document_date}
                onChange={(e) => {
                  if (!isEditingBlocked) {
                    setFormData({ ...formData, document_date: e.target.value });
                    setHasUnsavedChanges(true);
                  }
                }}
                disabled={isEditingBlocked}
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Anuluj
            </Button>
            <Button 
              onClick={handleSaveDocument} 
              disabled={isLoading || isEditingBlocked}
            >
              {isLoading ? 'Zapisywanie...' : 'Zapisz dokument'}
            </Button>
          </div>

          {/* Transactions section */}
          {document && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Operacje</h3>
              
              {!isEditingBlocked && (
                <TransactionForm
                  onAdd={handleTransactionAdded}
                  onCancel={() => {}}
                />
              )}

              <DocumentTable
                documentId={document.id}
                onTransactionEdit={(transaction) => {
                  setSelectedTransaction(transaction);
                  setIsEditDialogOpen(true);
                }}
                onTransactionDelete={handleTransactionDelete}
                onTransactionSplit={(transaction) => {
                  setSelectedTransaction(transaction);
                  setIsSplitDialogOpen(true);
                }}
                isEditingBlocked={isEditingBlocked}
              />
            </div>
          )}
        </div>

        {/* Edit Transaction Dialog */}
        <TransactionEditDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedTransaction(null);
          }}
          onSave={(updatedTransaction) => {
            // Handle save logic
            setIsEditDialogOpen(false);
            setSelectedTransaction(null);
            queryClient.invalidateQueries({ queryKey: ['transactions', document?.id] });
          }}
          transaction={selectedTransaction}
        />

        {/* Split Transaction Dialog */}
        <TransactionSplitDialog
          isOpen={isSplitDialogOpen}
          onClose={() => {
            setIsSplitDialogOpen(false);
            setSelectedTransaction(null);
          }}
          onSplit={() => {
            setIsSplitDialogOpen(false);
            setSelectedTransaction(null);
            queryClient.invalidateQueries({ queryKey: ['transactions', document?.id] });
          }}
          transaction={selectedTransaction}
          splitSide="debit"
        />

        {/* Confirm Close Dialog */}
        <ConfirmCloseDialog
          isOpen={showConfirmDialog}
          onConfirm={handleDiscardChanges}
          onCancel={() => setShowConfirmDialog(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default DocumentDialog;
