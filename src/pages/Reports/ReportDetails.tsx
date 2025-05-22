import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report, ReportSection, ReportEntry, SectionWithEntries } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, X, FileText, Download, RefreshCw } from 'lucide-react';
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
import { useAuth } from '@/context/AuthContext';
import { calculateFinancialSummary } from '@/utils/financeUtils';

interface ReportDetailsProps {
  reportId: string;
}

const rejectFormSchema = z.object({
  comments: z.string().min(1, { message: "Komentarz jest wymagany" }),
});

// Define proper type for the rejectMutation data
interface RejectFormData {
  comments: string;
}

const ReportDetailsComponent: React.FC<ReportDetailsProps> = ({ reportId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, checkPermission } = useAuth();
  const isReviewer = checkPermission(['prowincjal', 'admin']);
  const [isCalculating, setIsCalculating] = useState(false);
  
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
  
  // Pobieranie wpisów raportu pogrupowanych według sekcji
  const { data: sectionsWithEntries, isLoading: loadingSections } = useQuery({
    queryKey: ['reportSections', reportId],
    queryFn: async () => {
      try {
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
          .eq('report_type', 'standard') // Zawsze używamy 'standard', ignorując wartość z bazy danych
          .order('section_order', { ascending: true });
          
        if (sectionsError) throw sectionsError;
        
        if (!sections || sections.length === 0) {
          return [] as SectionWithEntries[];
        }
        
        // Pobierz wpisy raportu
        const { data: entries, error: entriesError } = await supabase
          .from('report_entries')
          .select('*')
          .eq('report_id', reportId);
          
        if (entriesError) throw entriesError;
        
        if (!entries) {
          return sections.map(section => ({
            section: {
              ...section,
              report_type: 'standard' as const // Wymuszenie typu 'standard'
            },
            entries: []
          })) as SectionWithEntries[];
        }
        
        console.log(`Znaleziono ${entries.length} wpisów w raporcie`);
        
        // Pogrupuj wpisy według sekcji
        const result: SectionWithEntries[] = sections.map(section => {
          const sectionEntries = entries.filter(entry => entry.section_id === section.id);
          return {
            section: {
              ...section,
              report_type: 'standard' as const // Wymuszenie typu 'standard'
            },
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
              report_type: 'standard' as const, // Wymuszenie typu 'standard'
              section_order: 999
            },
            entries: entriesWithoutSection
          });
        }
        
        return result;
      } catch (error) {
        console.error('Błąd podczas pobierania danych sekcji:', error);
        // Zwróć pustą tablicę w przypadku błędu
        return [] as SectionWithEntries[];
      }
    }
  });
  
  // Pobieranie szczegółów raportu (income_total, expense_total, itd.)
  const { data: reportDetails, isLoading: loadingDetails, refetch: refetchReportDetails } = useQuery({
    queryKey: ['reportDetails', reportId],
    queryFn: async () => {
      try {
        // Sprawdź, czy istnieje wpis w tabeli report_details
        const { data: existingDetails, error: checkError } = await supabase
          .from('report_details')
          .select('*')
          .eq('report_id', reportId);

        if (checkError) {
          console.error('Błąd podczas sprawdzania szczegółów raportu:', checkError);
          return null;
        }
        
        // Jeśli istnieją szczegóły, zwróć je
        if (existingDetails && existingDetails.length > 0) {
          return existingDetails[0];
        }
        
        // Jeśli nie ma szczegółów, oblicz je z wpisów
        console.log("Brak szczegółów raportu, obliczamy wartości...");
        await calculateAndUpdateReportTotals();
        
        // Pobierz ponownie po obliczeniu
        const { data: recalculatedDetails, error: recalcError } = await supabase
          .from('report_details')
          .select('*')
          .eq('report_id', reportId);
          
        if (recalcError || !recalculatedDetails || recalculatedDetails.length === 0) {
          console.error('Błąd po przeliczeniu szczegółów:', recalcError);
          return {
            id: null,
            report_id: reportId,
            income_total: 0,
            expense_total: 0,
            balance: 0,
            settlements_total: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        
        return recalculatedDetails[0];
      } catch (error) {
        console.error('Błąd podczas pobierania szczegółów raportu:', error);
        // Zwróć domyślne wartości w przypadku błędu
        return {
          id: null,
          report_id: reportId,
          income_total: 0,
          expense_total: 0,
          balance: 0,
          settlements_total: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }
  });

  // Funkcja pomocnicza do zapisu lub aktualizacji report_details
  const updateOrInsertReportDetails = async (
    incomeTotal: number,
    expenseTotal: number,
    balance: number,
    settlementsTotal: number
  ) => {
    try {
      // Sprawdź czy istnieje już wpis w tabeli report_details
      const { data: existingDetails, error: checkError } = await supabase
        .from('report_details')
        .select('id')
        .eq('report_id', reportId);
      
      if (checkError) {
        console.error('Błąd podczas sprawdzania podsumowania raportu:', checkError);
        throw checkError;
      }
      
      if (existingDetails && existingDetails.length > 0) {
        console.log(`Aktualizacja istniejącego podsumowania ${existingDetails[0].id}`);
        // Aktualizuj istniejący rekord
        const { error: updateError } = await supabase
          .from('report_details')
          .update({
            income_total: incomeTotal,
            expense_total: expenseTotal,
            balance: balance,
            settlements_total: settlementsTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDetails[0].id);

        if (updateError) {
          console.error('Błąd przy aktualizacji podsumowania:', updateError);
          throw updateError;
        }
      } else {
        console.log(`Tworzenie nowego podsumowania dla raportu ${reportId}`);
        // Utwórz nowy rekord podsumowania
        const { error: insertError } = await supabase
          .from('report_details')
          .insert({
            report_id: reportId,
            income_total: incomeTotal,
            expense_total: expenseTotal,
            balance: balance,
            settlements_total: settlementsTotal
          });

        if (insertError) {
          console.error('Błąd przy tworzeniu podsumowania:', insertError);
          throw insertError;
        }
      }
      console.log('Podsumowanie zostało pomyślnie zaktualizowane');
    } catch (err) {
      console.error("Błąd podczas zapisu podsumowania:", err);
      throw err;
    }
  };

  // Funkcja do przeliczania sum raportu - teraz wykorzystuje calculateFinancialSummary
  const calculateAndUpdateReportTotals = async () => {
    if (!reportId || !report) return;
    
    console.log("Przeliczanie sum raportu z wykorzystaniem wspólnej funkcji calculateFinancialSummary");
    setIsCalculating(true);
    
    try {
      // Utwórz zakres dat dla miesiąca raportu
      const startDate = `${report.year}-${String(report.month).padStart(2, '0')}-01`;
      const endMonth = report.month === 12 ? 1 : report.month + 1;
      const endYear = report.month === 12 ? report.year + 1 : report.year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      
      // Użyj wspólnej funkcji do obliczania sum finansowych
      const summary = await calculateFinancialSummary(
        report.location_id,
        startDate,
        endDate
      );
      
      console.log("Obliczone sumy:", summary);
      
      // Zapisz podsumowanie
      await updateOrInsertReportDetails(
        summary.income, 
        summary.expense, 
        summary.balance,
        0 // UWAGA: Tutaj nadal używamy 0 dla rozrachunków - można dodać logikę obliczania rozrachunków
      );
      
      // Odśwież dane
      refetchReportDetails();
      
      toast({
        title: "Sukces",
        description: "Sumy raportu zostały przeliczone poprawnie.",
        variant: "default",
      });
    } catch (err) {
      console.error("Błąd podczas przeliczania podsumowania:", err);
      toast({
        title: "Błąd",
        description: "Nie udało się przeliczyć sum raportu.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };
  
  // Funkcja do inicjalizacji wpisów raportu na podstawie transakcji
  const initializeReportEntries = async (transactions) => {
    try {
      console.log(`Inicjalizacja wpisów raportu na podstawie ${transactions.length} transakcji`);
      
      // Pobierz dane kont
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*');
        
      if (accountsError) {
        console.error('Błąd pobierania kont:', accountsError);
        throw accountsError;
      }
      
      if (!accounts || accounts.length === 0) {
        console.error('Brak kont w bazie danych');
        throw new Error('Brak kont w bazie danych');
      }
      
      console.log(`Znaleziono ${accounts.length} kont`);
      
      // Pobierz sekcje raportu
      const { data: sections, error: sectionsError } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', 'standard');
        
      if (sectionsError) {
        console.error('Błąd pobierania sekcji:', sectionsError);
        throw sectionsError;
      }
      
      // Pobierz mapowania kont do sekcji
      const { data: accountMappings, error: mappingError } = await supabase
        .from('account_section_mappings')
        .select('*')
        .eq('report_type', 'standard');
        
      if (mappingError) {
        console.error('Błąd pobierania mapowań kont:', mappingError);
        throw mappingError;
      }
      
      // Utwórz mapę mapowań kont do sekcji
      const sectionMap = new Map();
      if (accountMappings) {
        for (const mapping of accountMappings) {
          sectionMap.set(mapping.account_prefix, mapping.section_id);
        }
      }
      
      // Przygotuj agregaty dla każdego konta
      const accountsMap = new Map(accounts.map(acc => [acc.id, acc]));
      const aggregates = {};
      
      // Przetwarzaj transakcje
      for (const transaction of transactions) {
        // Znajdź konto debetowe
        const debitAccount = accountsMap.get(transaction.debit_account_id);
        // Znajdź konto kredytowe
        const creditAccount = accountsMap.get(transaction.credit_account_id);
        
        if (!debitAccount || !creditAccount) {
          console.warn(`Nie znaleziono kont dla transakcji ${transaction.id}`);
          continue;
        }
        
        // Inicjalizuj agregaty dla kont, jeśli nie istnieją
        if (!aggregates[debitAccount.number]) {
          aggregates[debitAccount.number] = {
            account_number: debitAccount.number,
            account_name: debitAccount.name,
            debit_turnover: 0,
            credit_turnover: 0,
            debit_opening: 0,
            credit_opening: 0,
            debit_closing: 0,
            credit_closing: 0
          };
        }
        
        if (!aggregates[creditAccount.number]) {
          aggregates[creditAccount.number] = {
            account_number: creditAccount.number,
            account_name: creditAccount.name,
            debit_turnover: 0,
            credit_turnover: 0,
            debit_opening: 0,
            credit_opening: 0,
            debit_closing: 0,
            credit_closing: 0
          };
        }
        
        // Aktualizuj agregaty dla obu kont
        const amount = Number(transaction.amount);
        
        if (isNaN(amount)) {
          console.warn(`Niepoprawna kwota transakcji ${transaction.id}: ${transaction.amount}`);
          continue;
        }
        
        console.log(`Przetwarzam transakcję ${transaction.id}: ${debitAccount.number} (Wn) -> ${creditAccount.number} (Ma), kwota: ${amount}`);
        
        // Konto debetowe - dodaj do obrotów Wn i salda końcowego Wn
        aggregates[debitAccount.number].debit_turnover += amount;
        if (debitAccount.type === 'bilansowe') {
          aggregates[debitAccount.number].debit_closing += amount;
        }
        
        // Konto kredytowe - dodaj do obrotów Ma i salda końcowego Ma
        aggregates[creditAccount.number].credit_turnover += amount;
        if (creditAccount.type === 'bilansowe') {
          aggregates[creditAccount.number].credit_closing += amount;
        }
      }
      
      // Przygotuj wpisy do wstawienia
      const entriesToInsert = [];
      
      for (const accountNumber in aggregates) {
        const aggregate = aggregates[accountNumber];
        
        // Znajdź sekcję dla konta
        let sectionId = null;
        
        // Sprawdź prefiksy od najdłuższych do najkrótszych
        for (let i = accountNumber.length; i > 0; i--) {
          const prefix = accountNumber.substring(0, i);
          if (sectionMap.has(prefix)) {
            sectionId = sectionMap.get(prefix);
            break;
          }
        }
        
        // Dodaj wpis tylko jeśli ma jakiś obrót (nie jest zerowy)
        if (aggregate.debit_turnover > 0 || aggregate.credit_turnover > 0) {
          entriesToInsert.push({
            report_id: reportId,
            section_id: sectionId,
            account_number: accountNumber,
            account_name: aggregate.account_name,
            debit_opening: aggregate.debit_opening,
            credit_opening: aggregate.credit_opening,
            debit_turnover: aggregate.debit_turnover,
            credit_turnover: aggregate.credit_turnover,
            debit_closing: aggregate.debit_closing,
            credit_closing: aggregate.credit_closing
          });
        }
      }
      
      console.log(`Przygotowano ${entriesToInsert.length} wpisów do zapisania`);
      
      if (entriesToInsert.length === 0) {
        console.warn("Brak wpisów do zapisania po przetworzeniu transakcji");
        return;
      }
      
      // Usuń istniejące wpisy dla tego raportu, aby uniknąć duplikatów
      const { error: deleteError } = await supabase
        .from('report_entries')
        .delete()
        .eq('report_id', reportId);
        
      if (deleteError) {
        console.error('Błąd podczas usuwania istniejących wpisów:', deleteError);
      }
      
      // Zapisuj wpisy w paczkach po 50, aby obejść ograniczenia RLS
      const batchSize = 50;
      for (let i = 0; i < entriesToInsert.length; i += batchSize) {
        const batch = entriesToInsert.slice(i, i + batchSize);
        try {
          const { error } = await supabase
            .from('report_entries')
            .insert(batch);
            
          if (error) {
            console.error(`Błąd zapisywania paczki wpisów (${i} do ${i + batch.length})`, error);
          }
        } catch (error) {
          console.error(`Wyjątek podczas zapisywania paczki wpisów (${i} do ${i + batch.length}):`, error);
        }
      }
      
      console.log('Zakończono inicjalizację wpisów raportu');
      
    } catch (error) {
      console.error('Błąd podczas inicjalizacji wpisów raportu:', error);
      throw error;
    }
  };
  
  // Efekt, który przelicza sumy raportu po załadowaniu danych
  useEffect(() => {
    if (reportId && report && !loadingSections) {
      // Przeliczaj sumy przy ładowaniu szczegółów raportu i gdy zmieniają się wpisy
      calculateAndUpdateReportTotals().catch(error => {
        console.error("Błąd przy przeliczaniu sum raportu:", error);
      });
    }
  }, [reportId, report, sectionsWithEntries]);
  
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
        description: `Nie udało się zaakceptować raportu: ${error instanceof Error ? error.message : "Nieznany błąd"}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutacja do odrzucania raportu
  const rejectMutation = useMutation({
    mutationFn: async (data: RejectFormData) => {
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
        description: `Nie udało się odrzucić raportu: ${error instanceof Error ? error.message : "Nieznany błąd"}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutacja do złożenia raportu
  const submitReportMutation = useMutation({
    mutationFn: async () => {
      // Przelicz sumy przed złożeniem raportu
      await calculateAndUpdateReportTotals();
      
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', reportId);
        
      if (error) throw error;
      
      // Wyślij powiadomienie do prowincjałów i adminów
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'prowincjal']);
        
      if (!adminsError && admins && admins.length > 0) {
        for (const admin of admins) {
          await supabase
            .from('notifications')
            .insert({
              user_id: admin.id,
              title: 'Złożono nowy raport',
              message: `Raport "${report?.title}" został złożony i oczekuje na sprawdzenie.`,
              priority: 'medium',
              action_label: 'Zobacz raport',
              action_link: `/reports/${reportId}`
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast({
        title: "Sukces",
        description: "Raport został złożony do zatwierdzenia.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się złożyć raportu: ${error instanceof Error ? error.message : "Nieznany błąd"}`,
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
    rejectMutation.mutate({ comments: values.comments });
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
  
  // Rendering głównego komponentu z podsumowaniem podobnym do tego z KPiR
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
                report?.status === 'submitted' ? 'text-blue-600' : 'text-yellow-600'
              }`}>
                {report?.status === 'draft' ? 'Roboczy' : 
                 report?.status === 'submitted' ? 'Złożony' : 
                 report?.status === 'accepted' ? 'Zaakceptowany' : 
                 report?.status === 'rejected' ? 'Odrzucony' : report?.status}
              </span>
            </p>
          </div>
          
          <div className="flex gap-2">
            {report?.status === 'draft' && (
              <Button 
                onClick={() => submitReportMutation.mutate()}
                disabled={submitReportMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {submitReportMutation.isPending && <Spinner className="h-4 w-4" />}
                Złóż raport
              </Button>
            )}
            
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
      
      {/* Sekcja decyzji - tylko dla prowincjała lub admina */}
      {report?.status === 'submitted' && isReviewer && (
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
      
      {/* Sekcja podsumowania finansowego w stylu bliższym do podanego obrazka */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Przychody</h3>
          <p className="text-3xl font-bold text-green-600">
            {reportDetails?.income_total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Rozchody</h3>
          <p className="text-3xl font-bold text-red-600">
            {reportDetails?.expense_total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Bilans</h3>
          <p className={`text-3xl font-bold ${(reportDetails?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {reportDetails?.balance?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Rozrachunki</h3>
          <p className="text-3xl font-bold text-blue-600">
            {reportDetails?.settlements_total?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0,00 zł'}
          </p>
        </div>
      </div>
      
      {/* Przycisk do ręcznego przeliczania sum */}
      <div className="mt-4 flex justify-end">
        <Button
          variant="outline"
          onClick={() => calculateAndUpdateReportTotals()}
          disabled={isCalculating}
          className="flex items-center gap-2"
        >
          {isCalculating ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          {isCalculating ? 'Przeliczanie...' : 'Przelicz sumy'}
        </Button>
      </div>
    </div>
  );
};

export default ReportDetailsComponent;
