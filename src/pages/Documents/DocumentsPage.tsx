
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, FileText, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import DocumentDialog from './DocumentDialog';
import { useToast } from '@/hooks/use-toast';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  // Fetch documents with related data
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      console.log('Fetching documents...');
      
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

      console.log('Documents fetched:', documentsWithCounts);
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
      format(new Date(doc.document_date), 'dd.MM.yyyy').includes(search) ||
      doc.locations?.name.toLowerCase().includes(search)
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
          <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nowy dokument
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Szukaj po numerze, nazwie, dacie lub lokalizacji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Documents grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((document) => (
            <Card 
              key={document.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleDocumentClick(document)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  {document.document_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-gray-900">{document.document_name}</p>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(document.document_date), 'dd MMMM yyyy', { locale: pl })}
                </div>
                
                {document.locations && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {document.locations.name}
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm text-gray-500 pt-2 border-t">
                  <span>Transakcje: {document.transaction_count}</span>
                  <span>
                    {format(new Date(document.created_at), 'dd.MM.yyyy')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredDocuments.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Nie znaleziono dokumentów' : 'Brak dokumentów'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? 'Spróbuj zmienić kryteria wyszukiwania' 
                : 'Utwórz pierwszy dokument, aby rozpocząć'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Utwórz dokument
              </Button>
            )}
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
