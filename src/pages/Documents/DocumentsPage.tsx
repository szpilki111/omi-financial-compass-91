
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
        .order('document_date', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }

      console.log('Raw documents data:', data);

      // Get transaction counts for each document
      const documentsWithCounts = await Promise.all(
        (data || []).map(async (doc) => {
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', doc.id);
          
          return {
            ...doc,
            // Handle the profiles array by taking the first element or null
            profiles: Array.isArray(doc.profiles) && doc.profiles.length > 0 ? doc.profiles[0] : null,
            transaction_count: count || 0
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
          <div className="symfonia-panel">
            <p className="text-xs">Ładowanie dokumentów...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-3">
        {/* Header panel */}
        <div className="symfonia-panel">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-sm font-bold text-black">Dokumenty</h1>
            <div className="flex gap-1">
              <Button onClick={handleSearchAccounts} variant="outline" className="flex items-center gap-1 text-xs">
                <Calculator className="h-3 w-3" />
                Wyszukaj konta
              </Button>
              <Button onClick={() => navigate('/kpir')} variant="outline" className="flex items-center gap-1 text-xs">
                <Search className="h-3 w-3" />
                Wyszukaj operacje
              </Button>
              <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Nowy dokument
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <label className="symfonia-label">Wyszukiwanie:</label>
            <Input
              placeholder="Szukaj po numerze, nazwie lub dacie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Documents table panel */}
        <div className="symfonia-panel">
          <DocumentTable
            documents={filteredDocuments}
            onDocumentClick={handleDocumentClick}
            isLoading={isLoading}
          />

          {filteredDocuments.length === 0 && !isLoading && searchTerm && (
            <div className="text-center py-8">
              <h3 className="text-sm font-bold text-black mb-2">
                Nie znaleziono dokumentów
              </h3>
              <p className="text-xs text-gray-600 mb-2">
                Spróbuj zmienić kryteria wyszukiwania
              </p>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="symfonia-statusbar">
          <span className="text-xs">
            {filteredDocuments ? `Liczba dokumentów: ${filteredDocuments.length}` : 'Ładowanie...'}
            {searchTerm && ` | Filtrowane po: "${searchTerm}"`}
          </span>
        </div>
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
