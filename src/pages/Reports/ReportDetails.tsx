
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_API_URL } from '@/integrations/supabase/client';
import { Report, ReportSection, ReportEntry, SectionWithEntries, ReportDetails } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, X, FileText, Download } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

interface ReportDetailsProps {
  reportId: string;
}

const rejectFormSchema = z.object({
  comments: z.string().min(1, { message: "Komentarz jest wymagany" }),
});

const ReportDetailsComponent: React.FC<ReportDetailsProps> = ({ reportId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('summary');
  
  // Formularz odrzucenia raportu
  const rejectForm = useForm<z.infer<typeof rejectFormSchema>>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: {
      comments: "",
    },
  });

  // Pobieranie danych raportu
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          location:locations(*),
          submitted_by_profile:profiles!submitted_by(id, name),
          reviewed_by_profile:profiles!reviewed_by(id, name)
        `)
        .eq('id', reportId)
        .single();
        
      if (error) throw error;
      return data;
    }
  });
  
  // Pobieranie szczegółów raportu (income_total, expense_total, itd.)
  const { data: reportDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['reportDetails', reportId],
    queryFn: async () => {
      // Używamy tradycyjnego fetch API zamiast supabase.from, ponieważ tabela report_details
      // nie jest jeszcze uwzględniona w typach Supabase
      const apiUrl = `${SUPABASE_API_URL}/rest/v1/report_details?report_id=eq.${reportId}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Nie udało się pobrać szczegółów raportu');
      }
      
      const data = await response.json();
      return data[0] as ReportDetails;
    }
  });

  // Pobieranie wpisów raportu pogrupowanych według sekcji
  const { data: sectionsWithEntries, isLoading: loadingSections } = useQuery({
    queryKey: ['reportSections', reportId],
    queryFn: async () => {
      // Pobierz sekcje dla typu raportu
      const { data: report } = await supabase
        .from('reports')
        .select('report_type')
        .eq('id', reportId)
        .single();
      
      if (!report) {
        throw new Error("Nie można znaleźć raportu");
      }
      
      const { data: sections, error: sectionsError } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', report.report_type)
        .order('section_order', { ascending: true });
        
      if (sectionsError) throw sectionsError;
      
      if (!sections || sections.length === 0) {
        return [];
      }
      
      // Pobierz wpisy raportu
      const { data: entries, error: entriesError } = await supabase
        .from('report_entries')
        .select('*')
        .eq('report_id', reportId);
        
      if (entriesError) throw entriesError;
      
      if (!entries) {
        return sections.map(section => ({
          section,
          entries: []
        }));
      }
      
      // Pogrupuj wpisy według sekcji
      const result: SectionWithEntries[] = sections.map(section => {
        const sectionEntries = entries.filter(entry => entry.section_id === section.id);
        return {
          section,
          entries: sectionEntries
        };
      });
      
      // Dodaj wpisy bez sekcji jeśli istnieją
      const entriesWithoutSection = entries.filter(entry => !entry.section_id);
      if (entriesWithoutSection.length > 0) {
        result.push({
          section: {
            id: 'no-section',
            name: 'Pozycje bez przypisanej sekcji',
            report_type: report.report_type,
            section_order: 999
          },
          entries: entriesWithoutSection
        });
      }
      
      return result;
    }
  });
  
  // Mutacja do akceptacji raportu
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'accepted',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', reportId);
        
      if (error) throw error;
      
      // Wyślij powiadomienie do użytkownika
      if (report?.submitted_by_profile?.id) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: report.submitted_by_profile.id,
            title: 'Raport zaakceptowany',
            message: `Twój raport "${report.title}" został zaakceptowany.`,
            priority: 'normal',
            action_label: 'Zobacz raport',
            action_link: `/reports/${reportId}`
          });
          
        if (notifError) console.error('Błąd wysyłania powiadomienia:', notifError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast({
        title: "Sukces",
        description: "Raport został zaakceptowany.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaakceptować raportu: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutacja do odrzucania raportu
  const rejectMutation = useMutation({
    mutationFn: async (data: { comments: string }) => {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          comments: data.comments
        })
        .eq('id', reportId);
        
      if (error) throw error;
      
      // Wyślij powiadomienie do użytkownika
      if (report?.submitted_by_profile?.id) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: report.submitted_by_profile.id,
            title: 'Raport odrzucony',
            message: `Twój raport "${report.title}" został odrzucony. Sprawdź komentarze.`,
            priority: 'high',
            action_label: 'Zobacz raport',
            action_link: `/reports/${reportId}`
          });
          
        if (notifError) console.error('Błąd wysyłania powiadomienia:', notifError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast({
        title: "Sukces",
        description: "Raport został odrzucony.",
        variant: "default",
      });
      rejectForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się odrzucić raportu: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutacja do aktualizacji szczegółów raportu
  const updateDetailsMutation = useMutation({
    mutationFn: async (details: Partial<ReportDetails>) => {
      // Używamy tradycyjnego fetch API zamiast supabase.from, ponieważ tabela report_details
      // nie jest jeszcze uwzględniona w typach Supabase
      const apiUrl = `${SUPABASE_API_URL}/rest/v1/report_details?report_id=eq.${reportId}`;
      
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ...details,
          updated_at: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Nie udało się zaktualizować szczegółów raportu');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportDetails', reportId] });
      toast({
        title: "Sukces",
        description: "Szczegóły raportu zostały zaktualizowane.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować szczegółów: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Funkcja do eksportu raportu do PDF
  const handleExportToPDF = () => {
    toast({
      title: "Informacja",
      description: "Funkcja eksportu do PDF będzie dostępna wkrótce.",
      variant: "default",
    });
  };
  
  // Funkcja do eksportu raportu do Excel
  const handleExportToExcel = () => {
    toast({
      title: "Informacja",
      description: "Funkcja eksportu do Excel będzie dostępna wkrótce.",
      variant: "default",
    });
  };
  
  // Obsługa formularza odrzucenia raportu
  const onRejectSubmit = (values: z.infer<typeof rejectFormSchema>) => {
    rejectMutation.mutate(values);
  };
  
  // Wyświetlanie loadera podczas ładowania danych
  if (loadingReport || loadingDetails || loadingSections) {
    return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  }
  
  // Sprawdzenie czy raport istnieje
  if (!report) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-semibold text-red-500">Błąd</h2>
        <p className="mt-2">Nie można znaleźć raportu o podanym ID.</p>
      </div>
    );
  }
  
  // Rendering głównego komponentu
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-semibold">{report?.title}</h2>
            <p className="text-omi-gray-500">
              Status: <span className={`font-medium ${
                report?.status === 'accepted' ? 'text-green-600' : 
                report?.status === 'rejected' ? 'text-red-600' : 
                report?.status === 'submitted' ? 'text-blue-600' : ''
              }`}>
                {report?.status === 'draft' ? 'Roboczy' : 
                 report?.status === 'submitted' ? 'Złożony' : 
                 report?.status === 'accepted' ? 'Zaakceptowany' : 
                 report?.status === 'rejected' ? 'Odrzucony' : report?.status}
              </span>
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportToPDF} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Eksportuj do PDF
            </Button>
            <Button variant="outline" onClick={handleExportToExcel} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Eksportuj do Excel
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-omi-gray-500">Placówka:</p>
            <p className="font-medium">{report?.location?.name}</p>
          </div>
          <div>
            <p className="text-omi-gray-500">Okres:</p>
            <p className="font-medium">{report?.period}</p>
          </div>
          {report?.submitted_at && (
            <div>
              <p className="text-omi-gray-500">Data złożenia:</p>
              <p className="font-medium">{format(new Date(report.submitted_at), 'PPP', { locale: pl })}</p>
            </div>
          )}
          {report?.submitted_by_profile?.name && (
            <div>
              <p className="text-omi-gray-500">Złożony przez:</p>
              <p className="font-medium">{report.submitted_by_profile.name}</p>
            </div>
          )}
          {report?.reviewed_at && (
            <div>
              <p className="text-omi-gray-500">Data przeglądu:</p>
              <p className="font-medium">{format(new Date(report.reviewed_at), 'PPP', { locale: pl })}</p>
            </div>
          )}
          {report?.reviewed_by_profile?.name && (
            <div>
              <p className="text-omi-gray-500">Przejrzany przez:</p>
              <p className="font-medium">{report.reviewed_by_profile.name}</p>
            </div>
          )}
        </div>
        
        {report?.comments && (
          <div className="mt-4 p-3 bg-omi-gray-100 rounded">
            <p className="text-sm font-medium mb-1">Komentarz:</p>
            <p className="text-sm">{report.comments}</p>
          </div>
        )}
      </div>
      
      {/* Jeśli raport ma status 'submitted', pokaż opcje akceptacji/odrzucenia */}
      {report?.status === 'submitted' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Decyzja</h3>
          <div className="flex gap-4 items-start">
            <Button 
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="flex items-center gap-2"
            >
              {acceptMutation.isPending && <Spinner className="h-4 w-4" />}
              <Check className="h-4 w-4" />
              Akceptuj raport
            </Button>
            
            <div className="flex-1">
              <Form {...rejectForm}>
                <form onSubmit={rejectForm.handleSubmit(onRejectSubmit)} className="space-y-4">
                  <FormField
                    control={rejectForm.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Powód odrzucenia</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Wpisz komentarz opisujący powód odrzucenia raportu..." 
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    variant="destructive" 
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {rejectMutation.isPending && <Spinner className="h-4 w-4" />}
                    <X className="h-4 w-4" />
                    Odrzuć raport
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 md:w-[500px] mb-4">
          <TabsTrigger value="summary">Podsumowanie</TabsTrigger>
          <TabsTrigger value="details">Szczegóły</TabsTrigger>
          <TabsTrigger value="entries">Zapisy</TabsTrigger>
        </TabsList>
        
        {/* Zawartość zakładki Podsumowanie */}
        <TabsContent value="summary" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Przychody</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  {reportDetails?.income_total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Rozchody</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {reportDetails?.expense_total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bilans</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(reportDetails?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {reportDetails?.balance?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Rozrachunki</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {reportDetails?.settlements_total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Zawartość zakładki Szczegóły */}
        <TabsContent value="details" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Szczegółowe informacje</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Ta sekcja będzie zawierać szczegółowe informacje o raporcie w zależności od jego typu.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Zawartość zakładki Zapisy */}
        <TabsContent value="entries" className="mt-0">
          {!sectionsWithEntries || sectionsWithEntries.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Brak zapisów</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Ten raport nie zawiera żadnych zapisów księgowych.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sectionsWithEntries.map((sectionWithEntries) => (
                <Card key={sectionWithEntries.section.id}>
                  <CardHeader>
                    <CardTitle>{sectionWithEntries.section.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sectionWithEntries.entries.length === 0 ? (
                      <p className="text-gray-500">Brak zapisów w tej sekcji</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-4">Konto</th>
                              <th className="text-left py-2 px-4">Nazwa</th>
                              <th className="text-right py-2 px-4">B.O. Winien</th>
                              <th className="text-right py-2 px-4">B.O. Ma</th>
                              <th className="text-right py-2 px-4">Obroty Winien</th>
                              <th className="text-right py-2 px-4">Obroty Ma</th>
                              <th className="text-right py-2 px-4">Saldo Winien</th>
                              <th className="text-right py-2 px-4">Saldo Ma</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sectionWithEntries.entries.map((entry) => (
                              <tr key={entry.id} className="border-b">
                                <td className="py-2 px-4">{entry.account_number}</td>
                                <td className="py-2 px-4">{entry.account_name}</td>
                                <td className="text-right py-2 px-4">
                                  {entry.debit_opening?.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) || '0,00'}
                                </td>
                                <td className="text-right py-2 px-4">
                                  {entry.credit_opening?.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) || '0,00'}
                                </td>
                                <td className="text-right py-2 px-4">
                                  {entry.debit_turnover?.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) || '0,00'}
                                </td>
                                <td className="text-right py-2 px-4">
                                  {entry.credit_turnover?.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) || '0,00'}
                                </td>
                                <td className="text-right py-2 px-4">
                                  {entry.debit_closing?.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) || '0,00'}
                                </td>
                                <td className="text-right py-2 px-4">
                                  {entry.credit_closing?.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) || '0,00'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportDetailsComponent;
