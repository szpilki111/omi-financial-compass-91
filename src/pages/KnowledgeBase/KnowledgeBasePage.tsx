import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  FileText, 
  Upload, 
  Plus, 
  Trash2, 
  Download, 
  StickyNote, 
  Pin, 
  PinOff,
  Search,
  Filter,
  BookOpen,
  FileQuestion,
  Loader2
} from 'lucide-react';
import PageTitle from '@/components/ui/PageTitle';

// Simple markdown renderer component
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const renderMarkdown = (text: string) => {
    // Split by lines to process each line
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    
    const flushList = () => {
      if (currentList.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={elements.length} className={listType === 'ul' ? 'list-disc pl-5 my-2' : 'list-decimal pl-5 my-2'}>
            {currentList.map((item, i) => (
              <li key={i} className="my-1">{renderInline(item)}</li>
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    const renderInline = (text: string): React.ReactNode => {
      // Bold: **text** or __text__
      let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
      // Italic: *text* or _text_
      result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      result = result.replace(/_([^_]+)_/g, '<em>$1</em>');
      // Code: `text`
      result = result.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
      
      return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    lines.forEach((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={index} className="font-semibold text-base mt-4 mb-2">{renderInline(line.slice(4))}</h3>);
      } else if (line.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={index} className="font-bold text-lg mt-4 mb-2">{renderInline(line.slice(3))}</h2>);
      } else if (line.startsWith('# ')) {
        flushList();
        elements.push(<h1 key={index} className="font-bold text-xl mt-4 mb-2">{renderInline(line.slice(2))}</h1>);
      }
      // Unordered list items
      else if (line.match(/^[-*]\s/) || line.match(/^- \[[ x]\]/)) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        const itemText = line.replace(/^[-*]\s/, '').replace(/^- \[[ x]\]\s?/, (match) => {
          const checked = match.includes('[x]');
          return checked ? '✅ ' : '☐ ';
        });
        currentList.push(itemText);
      }
      // Ordered list items
      else if (line.match(/^\d+\.\s/)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        currentList.push(line.replace(/^\d+\.\s/, ''));
      }
      // Empty line
      else if (line.trim() === '') {
        flushList();
        elements.push(<br key={index} />);
      }
      // Regular paragraph
      else {
        flushList();
        elements.push(<p key={index} className="my-1">{renderInline(line)}</p>);
      }
    });
    
    flushList();
    return elements;
  };

  return <>{renderMarkdown(content)}</>;
};

interface KnowledgeDocument {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  category: string;
  uploaded_by: string | null;
  created_at: string;
}

interface AdminNote {
  id: string;
  title: string;
  content: string | null;
  location_id: string | null;
  created_by: string | null;
  visible_to: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'procedures', label: 'Procedury', icon: FileText },
  { value: 'templates', label: 'Szablony', icon: FileText },
  { value: 'guides', label: 'Poradniki', icon: BookOpen },
  { value: 'other', label: 'Inne', icon: FileQuestion }
];

const KnowledgeBasePage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'prowincjal';

  // State
  const [activeTab, setActiveTab] = useState('documents');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Document upload state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [isUploading, setIsUploading] = useState(false);

  // Note state
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteLocationId, setNoteLocationId] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Fetch documents
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as KnowledgeDocument[];
    }
  });

  // Fetch notes
  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['admin-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AdminNote[];
    }
  });

  // Fetch locations for note assignment
  const { data: locations } = useQuery({
    queryKey: ['locations-for-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !uploadTitle) throw new Error('Brak pliku lub tytułu');

      setIsUploading(true);

      // Upload file to storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: uploadTitle,
          description: uploadDescription || null,
          file_path: filePath,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          category: uploadCategory,
          uploaded_by: user?.id
        });

      if (insertError) {
        // Cleanup uploaded file on error
        await supabase.storage.from('knowledge-base').remove([filePath]);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      toast.success('Dokument dodany pomyślnie');
      setIsUploadDialogOpen(false);
      resetUploadForm();
    },
    onError: (error: any) => {
      toast.error('Błąd dodawania dokumentu: ' + error.message);
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (doc: KnowledgeDocument) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('knowledge-base')
        .remove([doc.file_path]);

      if (storageError) console.error('Storage delete error:', storageError);

      // Delete record
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      toast.success('Dokument usunięty');
    },
    onError: (error: any) => {
      toast.error('Błąd usuwania: ' + error.message);
    }
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteTitle) throw new Error('Tytuł jest wymagany');

      setIsCreatingNote(true);

      const { error } = await supabase
        .from('admin_notes')
        .insert({
          title: noteTitle,
          content: noteContent || null,
          location_id: noteLocationId,
          created_by: user?.id,
          visible_to: ['ekonom', 'proboszcz', 'prowincjal', 'admin']
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
      toast.success('Notatka utworzona');
      setIsNoteDialogOpen(false);
      resetNoteForm();
    },
    onError: (error: any) => {
      toast.error('Błąd tworzenia notatki: ' + error.message);
    },
    onSettled: () => {
      setIsCreatingNote(false);
    }
  });

  // Toggle note pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async (note: AdminNote) => {
      const { error } = await supabase
        .from('admin_notes')
        .update({ pinned: !note.pinned })
        .eq('id', note.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
    }
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('admin_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
      toast.success('Notatka usunięta');
    }
  });

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadCategory('other');
  };

  const resetNoteForm = () => {
    setNoteTitle('');
    setNoteContent('');
    setNoteLocationId(null);
  };

  const downloadDocument = async (doc: KnowledgeDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('knowledge-base')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Błąd pobierania: ' + error.message);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Nieznany rozmiar';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Filter documents
  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter notes
  const filteredNotes = notes?.filter(note => {
    return note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           note.content?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageTitle 
        title="Baza wiedzy" 
        subtitle="Dokumenty, procedury i notatki administracyjne"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Dokumenty
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <StickyNote className="h-4 w-4" />
              Notatki
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>

            {activeTab === 'documents' && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isAdmin && activeTab === 'documents' && (
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Upload className="h-4 w-4" />
                    Dodaj dokument
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dodaj nowy dokument</DialogTitle>
                    <DialogDescription>
                      Prześlij dokument do bazy wiedzy
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label>Plik</Label>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadFile(file);
                            if (!uploadTitle) {
                              setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
                            }
                          }
                        }}
                      />
                    </div>

                    <div>
                      <Label>Tytuł</Label>
                      <Input
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Tytuł dokumentu"
                      />
                    </div>

                    <div>
                      <Label>Opis (opcjonalny)</Label>
                      <Textarea
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Krótki opis dokumentu"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>Kategoria</Label>
                      <Select value={uploadCategory} onValueChange={setUploadCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                      Anuluj
                    </Button>
                    <Button 
                      onClick={() => uploadMutation.mutate()}
                      disabled={!uploadFile || !uploadTitle || isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Przesyłanie...
                        </>
                      ) : (
                        'Dodaj'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {isAdmin && activeTab === 'notes' && (
              <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nowa notatka
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nowa notatka</DialogTitle>
                    <DialogDescription>
                      Utwórz notatkę dla użytkowników systemu
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label>Tytuł</Label>
                      <Input
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Tytuł notatki"
                      />
                    </div>

                    <div>
                      <Label>Treść</Label>
                      <Textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Treść notatki..."
                        rows={6}
                      />
                    </div>

                    <div>
                      <Label>Placówka (opcjonalnie)</Label>
                      <Select 
                        value={noteLocationId || 'global'} 
                        onValueChange={(v) => setNoteLocationId(v === 'global' ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz placówkę" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Globalna (dla wszystkich)</SelectItem>
                          {locations?.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                      Anuluj
                    </Button>
                    <Button 
                      onClick={() => createNoteMutation.mutate()}
                      disabled={!noteTitle || isCreatingNote}
                    >
                      {isCreatingNote ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Tworzenie...
                        </>
                      ) : (
                        'Utwórz'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <TabsContent value="documents">
          {documentsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak dokumentów do wyświetlenia</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments?.map(doc => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary">{getCategoryLabel(doc.category)}</Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteDocumentMutation.mutate(doc)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <CardTitle className="text-lg">{doc.title}</CardTitle>
                    {doc.description && (
                      <CardDescription>{doc.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>{doc.file_name}</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => downloadDocument(doc)}
                    >
                      <Download className="h-4 w-4" />
                      Pobierz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          {notesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotes?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak notatek do wyświetlenia</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNotes?.map(note => (
                <Card key={note.id} className={note.pinned ? 'border-primary/50 bg-primary/5' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {note.pinned && <Pin className="h-4 w-4 text-primary" />}
                        <CardTitle className="text-lg">{note.title}</CardTitle>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => togglePinMutation.mutate(note)}
                          >
                            {note.pinned ? (
                              <PinOff className="h-4 w-4" />
                            ) : (
                              <Pin className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <CardDescription>
                      {new Date(note.created_at).toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                      {note.location_id && locations && (
                        <span className="ml-2">
                          • {locations.find(l => l.id === note.location_id)?.name || 'Placówka'}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  {note.content && (
                    <CardContent>
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRenderer content={note.content} />
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeBasePage;
