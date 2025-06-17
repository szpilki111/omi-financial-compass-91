import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import DocumentDialog from './DocumentDialog';
import DocumentTable from './DocumentTable';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

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
  total_amount?: number;
}

const DocumentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  // Fetch documents with related data
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      console.log('Fetching documents for user:', user?.id);
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          locations(name),
          profiles!documents_user_id_fkey(name)
        `)
        .order('document_number', { ascending: false }); // Sortowanie od najnowszych

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }

      console.log('Raw documents data:', data);

      // Get transaction counts and total amounts for each document
      const documentsWithCounts = await Promise.all(
        (data || []).map(async (doc) => {
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', doc.id);
          
          // Get total amount for the document
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('document_id', doc.id);
          
          const totalAmount = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          
          return {
            ...doc,
            // Handle the profiles array by taking the first element or null
            profiles: Array.isArray(doc.profiles) && doc.profiles.length > 0 ? doc.profiles[0] : null,
            transaction_count: count || 0,
            total_amount: totalAmount
          };
        })
      );

      console.log('Documents with counts:', documentsWithCounts);
      return documentsWithCounts;
    },
  });

  // Filter documents based on search term
  const filteredDocuments = useMemo(() => {
    if (!documents || !searchTerm.trim()) {
      return documents || [];
    }

    const search = searchTerm.toLowerCase();
    return documents.filter(doc => 
      doc.document_number.toLowerCase().includes(search) ||
      doc.document_name.toLowerCase().includes(search) ||
      format(new Date(doc.document_date), 'dd.MM.yyyy').includes(search)
    );
  }, [documents, searchTerm]);

  const handleDocumentCreated = () => {
    refetch();
    setIsDialogOpen(false);
    toast({
      title: "Sukces",
      description: "Dokument został utworzony pomyślnie",
    });
  };

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setIsDialogOpen(true);
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten dokument? Wszystkie powiązane operacje również zostaną usunięte.')) {
      return;
    }

    try {
      // Call the Postgres function to delete document and related transactions
      const { error } = await supabase.rpc('delete_document_with_transactions', {
        p_document_id: documentId
      });

      if (error) {
        console.error('Error deleting document:', error);
        throw error;
      }

      toast({
        title: "Sukces",
        description: "Dokument i powiązane operacje zostały usunięte",
      });

      // Refresh the documents list
      refetch();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć dokumentu",
        variant: "destructive",
      });
    }
  };

  const handleSearchAccounts = () => {
    navigate('/wyszukaj-konta');
  };

  const handleSearchOperations = () => {
    navigate('/kpir');
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Dokumenty</h1>
          <div className="flex gap-2">
            <Button onClick={handleSearchAccounts} variant="outline" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Wyszukaj konta
            </Button>
            <Button onClick={() => navigate('/kpir')} variant="outline" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Wyszukaj operacje
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nowy dokument
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="             Szukaj po numerze, nazwie lub dacie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11"
          />
        </div>

        {/* Documents table */}
        <DocumentTable
          documents={filteredDocuments}
          onDocumentClick={handleDocumentClick}
          onDocumentDelete={handleDocumentDelete}
          isLoading={isLoading}
        />

        {filteredDocuments.length === 0 && !isLoading && searchTerm && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nie znaleziono dokumentów
            </h3>
            <p className="text-gray-600 mb-4">
              Spróbuj zmienić kryteria wyszukiwania
            </p>
          </div>
        )}
      </div>

      <DocumentDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedDocument(null);
        }}
        onDocumentCreated={handleDocumentCreated}
        document={selectedDocument}
      />
    </MainLayout>
  );
};

export default DocumentsPage;
