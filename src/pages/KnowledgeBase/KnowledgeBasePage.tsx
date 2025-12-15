import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Loader2,
  Home,
  DollarSign,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Folder,
  Files,
  Calculator,
  Users
} from 'lucide-react';
import PageTitle from '@/components/ui/PageTitle';

// Enhanced Markdown renderer with tables, code blocks, alerts, and horizontal rules
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let tableData: string[][] = [];
    let inTable = false;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    
    const flushList = () => {
      if (currentList.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={elements.length} className={listType === 'ul' ? 'list-disc pl-5 my-2 space-y-1' : 'list-decimal pl-5 my-2 space-y-1'}>
            {currentList.map((item, i) => (
              <li key={i} className="text-sm">{renderInline(item)}</li>
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    const flushTable = () => {
      if (tableData.length > 0) {
        const headers = tableData[0];
        const rows = tableData.slice(2); // Skip header separator row
        elements.push(
          <div key={elements.length} className="my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  {headers.map((cell, i) => (
                    <th key={i} className="border border-border px-3 py-2 text-left font-semibold">
                      {renderInline(cell.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border border-border px-3 py-2">
                        {renderInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableData = [];
        inTable = false;
      }
    };

    const renderInline = (text: string): React.ReactNode => {
      // Bold: **text** or __text__
      let result = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
      result = result.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>');
      // Italic: *text* or _text_
      result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
      result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
      // Code: `text`
      result = result.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
      // Links: [text](url)
      result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:no-underline">$1</a>');
      
      return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    lines.forEach((line, index) => {
      // Code block handling
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          elements.push(
            <pre key={elements.length} className="my-3 p-4 bg-muted/50 rounded-lg overflow-x-auto border border-border">
              <code className="text-xs font-mono">{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Start code block
          flushList();
          flushTable();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Table handling
      if (line.includes('|') && line.trim().startsWith('|')) {
        flushList();
        if (!inTable) inTable = true;
        const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (!line.includes('---')) {
          tableData.push(cells);
        } else {
          tableData.push([]); // Separator placeholder
        }
        return;
      } else if (inTable) {
        flushTable();
      }

      // Horizontal rule
      if (line.match(/^[-*_]{3,}$/)) {
        flushList();
        elements.push(<hr key={index} className="my-6 border-border" />);
        return;
      }

      // Blockquote / Alert
      if (line.startsWith('> ')) {
        flushList();
        const content = line.slice(2);
        let alertType = 'info';
        let alertIcon = '💡';
        if (content.includes('**Wskazówka**') || content.includes('💡')) {
          alertType = 'tip';
          alertIcon = '💡';
        } else if (content.includes('**Uwaga**') || content.includes('⚠️')) {
          alertType = 'warning';
          alertIcon = '⚠️';
        } else if (content.includes('❌') || content.includes('**Błąd**')) {
          alertType = 'error';
          alertIcon = '❌';
        }
        
        const bgColor = alertType === 'tip' ? 'bg-green-500/10 border-green-500/30' :
                       alertType === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                       alertType === 'error' ? 'bg-red-500/10 border-red-500/30' :
                       'bg-blue-500/10 border-blue-500/30';
        
        elements.push(
          <div key={index} className={`my-3 p-3 rounded-lg border-l-4 ${bgColor}`}>
            <p className="text-sm">{renderInline(content)}</p>
          </div>
        );
        return;
      }

      // Headers
      if (line.startsWith('#### ')) {
        flushList();
        elements.push(<h4 key={index} className="font-semibold text-sm mt-4 mb-2 text-muted-foreground">{renderInline(line.slice(5))}</h4>);
      } else if (line.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={index} className="font-semibold text-base mt-5 mb-2 text-foreground">{renderInline(line.slice(4))}</h3>);
      } else if (line.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={index} className="font-bold text-lg mt-6 mb-3 text-foreground border-b border-border pb-2">{renderInline(line.slice(3))}</h2>);
      } else if (line.startsWith('# ')) {
        flushList();
        elements.push(<h1 key={index} className="font-bold text-xl mt-6 mb-3 text-foreground">{renderInline(line.slice(2))}</h1>);
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
      }
      // Regular paragraph
      else {
        flushList();
        elements.push(<p key={index} className="my-2 text-sm leading-relaxed">{renderInline(line)}</p>);
      }
    });
    
    flushList();
    flushTable();
    return elements;
  };

  return <div className="prose-content">{renderMarkdown(content)}</div>;
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
  category?: string | null;
  location_id: string | null;
  created_by: string | null;
  visible_to: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_CATEGORIES = [
  { value: 'procedures', label: 'Procedury', icon: FileText },
  { value: 'templates', label: 'Szablony', icon: Files },
  { value: 'guides', label: 'Poradniki', icon: BookOpen },
  { value: 'other', label: 'Inne', icon: FileQuestion }
];

const NOTE_CATEGORIES = [
  { value: 'all', label: 'Wszystkie', icon: Folder, color: 'bg-gray-500' },
  { value: 'wprowadzenie', label: 'Wprowadzenie', icon: Home, color: 'bg-blue-500' },
  { value: 'dokumenty', label: 'Dokumenty', icon: FileText, color: 'bg-green-500' },
  { value: 'raporty', label: 'Raporty', icon: BarChart3, color: 'bg-purple-500' },
  { value: 'budzet', label: 'Budżet', icon: DollarSign, color: 'bg-yellow-500' },
  { value: 'konta', label: 'Konta', icon: Calculator, color: 'bg-cyan-500' },
  { value: 'administracja', label: 'Administracja', icon: Settings, color: 'bg-orange-500' },
  { value: 'faq', label: 'FAQ i Słownik', icon: HelpCircle, color: 'bg-pink-500' },
];

const getCategoryInfo = (category: string | null | undefined) => {
  const cat = NOTE_CATEGORIES.find(c => c.value === category);
  return cat || NOTE_CATEGORIES[0];
};

const KnowledgeBasePage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'prowincjal';

  // State
  const [activeTab, setActiveTab] = useState('notes'); // Start with notes since that's where the content is
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<string>('all');
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  
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
  const [noteCategory, setNoteCategory] = useState('inne');
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

      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

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
      const { error: storageError } = await supabase.storage
        .from('knowledge-base')
        .remove([doc.file_path]);

      if (storageError) console.error('Storage delete error:', storageError);

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
          category: noteCategory,
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
    setNoteCategory('inne');
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

  const toggleNoteExpanded = (noteId: string) => {
    setExpandedNotes(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
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
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = noteCategoryFilter === 'all' || note.category === noteCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group notes by category for sidebar count
  const noteCountByCategory = notes?.reduce((acc, note) => {
    const cat = note.category || 'inne';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <MainLayout>
      <div className="space-y-6">
      <PageTitle 
        title="Baza wiedzy" 
        subtitle="Kompletna dokumentacja systemu finansowego OMI"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <TabsList className="grid grid-cols-2 w-full lg:w-auto">
            <TabsTrigger value="notes" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Artykuły ({notes?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Dokumenty ({documents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj w treści..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full lg:w-[250px]"
              />
            </div>

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
                          {DOCUMENT_CATEGORIES.map(cat => (
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
                    Nowy artykuł
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nowy artykuł</DialogTitle>
                    <DialogDescription>
                      Utwórz nowy artykuł w bazie wiedzy (obsługuje format Markdown)
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Tytuł</Label>
                        <Input
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          placeholder="Tytuł artykułu"
                        />
                      </div>
                      <div>
                        <Label>Kategoria</Label>
                        <Select value={noteCategory} onValueChange={setNoteCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NOTE_CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>
                                <span className="flex items-center gap-2">
                                  <cat.icon className="h-4 w-4" />
                                  {cat.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Treść (Markdown)</Label>
                      <Textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="## Nagłówek&#10;&#10;Treść artykułu...&#10;&#10;- Lista&#10;- Punktów&#10;&#10;> 💡 **Wskazówka**: Ważna informacja"
                        rows={12}
                        className="font-mono text-sm"
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

        <TabsContent value="notes">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Category Sidebar */}
            <div className="w-full lg:w-64 flex-shrink-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Kategorie
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {NOTE_CATEGORIES.map(cat => {
                      const count = cat.value === 'all' 
                        ? notes?.length || 0 
                        : noteCountByCategory[cat.value] || 0;
                      const isActive = noteCategoryFilter === cat.value;
                      
                      return (
                        <button
                          key={cat.value}
                          onClick={() => setNoteCategoryFilter(cat.value)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive 
                              ? 'bg-primary text-primary-foreground' 
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </span>
                          <Badge variant={isActive ? "secondary" : "outline"} className="text-xs">
                            {count}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Articles List */}
            <div className="flex-1 min-w-0">
              {notesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredNotes?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Brak artykułów do wyświetlenia</p>
                    {searchTerm && <p className="text-sm mt-2">Spróbuj zmienić kryteria wyszukiwania</p>}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredNotes?.map(note => {
                    const categoryInfo = getCategoryInfo(note.category);
                    const isExpanded = expandedNotes.includes(note.id);
                    const hasLongContent = (note.content?.length || 0) > 500;
                    
                    return (
                      <Card 
                        key={note.id} 
                        className={`transition-all duration-200 ${
                          note.pinned ? 'border-primary/50 bg-primary/5 shadow-md' : 'hover:shadow-md'
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {note.pinned && (
                                  <Badge variant="default" className="gap-1">
                                    <Pin className="h-3 w-3" />
                                    Przypięty
                                  </Badge>
                                )}
                                <Badge 
                                  variant="secondary" 
                                  className={`gap-1 ${categoryInfo.color} text-white`}
                                >
                                  <categoryInfo.icon className="h-3 w-3" />
                                  {categoryInfo.label}
                                </Badge>
                              </div>
                              <CardTitle className="text-lg leading-tight">{note.title}</CardTitle>
                              <CardDescription className="mt-1">
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
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => togglePinMutation.mutate(note)}
                                  title={note.pinned ? 'Odepnij' : 'Przypnij'}
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
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteNoteMutation.mutate(note.id)}
                                  title="Usuń"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        {note.content && (
                          <CardContent className="pt-0">
                            <Collapsible open={isExpanded || !hasLongContent}>
                              <CollapsibleContent forceMount className={!isExpanded && hasLongContent ? 'max-h-[300px] overflow-hidden relative' : ''}>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <MarkdownRenderer content={
                                    // Strip first heading line if it matches the title
                                    note.content.replace(/^##?\s*[^\n]+\n+/, '')
                                  } />
                                </div>
                                {!isExpanded && hasLongContent && (
                                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
                                )}
                              </CollapsibleContent>
                              {hasLongContent && (
                                <CollapsibleTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    className="w-full mt-2 gap-2"
                                    onClick={() => toggleNoteExpanded(note.id)}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-4 w-4" />
                                        Zwiń artykuł
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-4 w-4" />
                                        Rozwiń artykuł
                                      </>
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </Collapsible>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="mb-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie kategorie</SelectItem>
                {DOCUMENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {documentsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak dokumentów do wyświetlenia</p>
                <p className="text-sm mt-2">Dokumenty PDF, Word i Excel można dodać klikając "Dodaj dokument"</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments?.map(doc => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary">
                        {DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                      </Badge>
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
                      <span className="truncate">{doc.file_name}</span>
                      <span className="flex-shrink-0 ml-2">{formatFileSize(doc.file_size)}</span>
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
      </Tabs>
      </div>
    </MainLayout>
  );
};

export default KnowledgeBasePage;
