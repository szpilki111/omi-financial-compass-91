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

  // Funkcja do przeliczania sum raportu
  const calculateAndUpdateReportTotals = async () => {
    if (!reportId) return;
    
    console.log("Przeliczanie sum raportu bezpośrednio z wpisów");
    setIsCalculating(true);
    
    try {
      // Pobierz wszystkie wpisy raportu bezpośrednio z bazy danych
      const { data: entries, error: entriesError } = await supabase
        .from('report_entries')
        .select('*')
        .eq('report_id', reportId);
        
      if (entriesError) {
        console.error('Błąd podczas pobierania wpisów raportu:', entriesError);
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać wpisów raportu.",
          variant: "destructive",
        });
        setIsCalculating(false);
        return;
      }
      
      if (!entries || entries.length === 0) {
        console.log("Brak wpisów do przeliczenia sum");
        
        // Jeśli nie ma wpisów, sprawdźmy czy nie ma powiązanych transakcji
        const { data: transactions, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('location_id', report?.location_id)
          .gte('date', `${report?.year}-${String(report?.month).padStart(2, '0')}-01`)
          .lt('date', `${report?.year}-${String(report?.month + 1 > 12 ? 1 : report?.month + 1).padStart(2, '0')}-01`);
          
        if (transactionsError) {
          console.error('Błąd pobierania transakcji:', transactionsError);
        }
        
        if (transactions && transactions.length > 0) {
          console.log(`Znaleziono ${transactions.length} transakcji do wygenerowania wpisów raportu`);
          
          // Inicjalizuj wpisy raportu na podstawie transakcji
          await initializeReportEntries(transactions);
          
          // Po inicjalizacji, spróbuj ponownie pobrać wpisy
          const { data: freshEntries, error: freshError } = await supabase
            .from('report_entries')
            .select('*')
            .eq('report_id', reportId);
            
          if (freshError) {
            console.error('Błąd podczas ponownego pobierania wpisów:', freshError);
            setIsCalculating(false);
            return;
          }
          
          if (!freshEntries || freshEntries.length === 0) {
            console.log("Nadal brak wpisów po inicjalizacji");
            toast({
              title: "Informacja",
              description: "Brak wpisów w raporcie. Sumy ustawione na 0.",
              variant: "default",
            });
            // Zapisz domyślne wartości
            await updateOrInsertReportDetails(0, 0, 0, 0);
            setIsCalculating(false);
            refetchReportDetails();
            return;
          }
          
          // Kontynuuj z obliczeniami używając nowo utworzonych wpisów
          entries = freshEntries;
        } else {
          console.log("Brak transakcji do wygenerowania wpisów");
          toast({
            title: "Informacja",
            description: "Brak wpisów i transakcji. Sumy ustawione na 0.",
            variant: "default",
          });
          // Zapisz domyślne wartości
          await updateOrInsertReportDetails(0, 0, 0, 0);
          setIsCalculating(false);
          refetchReportDetails();
          return;
        }
      }
      
      console.log(`Znaleziono ${entries.length} wpisów do przeliczenia sum`);
      
      // Sumowanie przychodów i rozchodów
      let incomeTotal = 0;
      let expenseTotal = 0;
      let settlementsTotal = 0;
      
      entries.forEach(entry => {
        // Walidacja danych
        if (!entry.account_number) {
          console.warn(`Wpis bez numeru konta: ${entry.id}`);
          return;
        }
        
        console.log(`Analizuję wpis: ${entry.account_number} - ${entry.account_name}`, entry);
        
        // Sprawdź czy konto zaczyna się od numeru przychodów (7xx)
        if (entry.account_number && entry.account_number.startsWith('7')) {
          // Przychody są zwykle po stronie Ma (credit)
          const value = Number(entry.credit_turnover || 0);
          if (isNaN(value)) {
            console.warn(`Niepoprawna wartość credit_turnover dla konta ${entry.account_number}: ${entry.credit_turnover}`);
            return;
          }
          console.log(`Znaleziono przychód: ${value} (konto ${entry.account_number})`);
          incomeTotal += value;
        }
        // Sprawdź czy konto zaczyna się od numeru kosztów (4xx)
        else if (entry.account_number && entry.account_number.startsWith('4')) {
          // Koszty są zwykle po stronie Winien (debit)
          const value = Number(entry.debit_turnover || 0);
          if (isNaN(value)) {
            console.warn(`Niepoprawna wartość debit_turnover dla konta ${entry.account_number}: ${entry.debit_turnover}`);
            return;
          }
          console.log(`Znaleziono koszt: ${value} (konto ${entry.account_number})`);
          expenseTotal += value;
        }
        // Sprawdź czy konto zaczyna się od numeru rozrachunków (2xx)
        else if (entry.account_number && entry.account_number.startsWith('2')) {
          // Absolutna wartość salda
          const debitClosing = Number(entry.debit_closing || 0);
          const creditClosing = Number(entry.credit_closing || 0);
          if (isNaN(debitClosing) || isNaN(creditClosing)) {
            console.warn(`Niepoprawne wartości debit_closing lub credit_closing dla konta ${entry.account_number}`);
            return;
          }
          const value = Math.abs(debitClosing - creditClosing);
          console.log(`Znaleziono rozrachunek: ${value} (konto ${entry.account_number})`);
          settlementsTotal += value;
        }
        else {
          console.log(`Konto ${entry.account_number} nie pasuje do żadnej kategorii (przychód, koszt, rozrachunek)`);
        }
      });
      
      // Oblicz bilans jako różnicę między przychodami a wydatkami
      const balance = incomeTotal - expenseTotal;
      
      console.log("Obliczone sumy:", { incomeTotal, expenseTotal, balance, settlementsTotal });
      
      // Zapisz podsumowanie
      await updateOrInsertReportDetails(incomeTotal, expenseTotal, balance, settlementsTotal);
      
      // Odśwież dane
      refetchReportDetails();
      
      toast({
        title: "Sukces",
        description: "Sumy raportu zostały przeliczone pomyślnie.",
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
        return;
      }
      
      if (!accounts || accounts.length === 0) {
        console.error('Brak kont w bazie danych');
        return;
      }
      
      console.log(`Znaleziono ${accounts.length} kont`);
      
      // Pobierz sekcje raportu
      const { data: sections, error: sectionsError } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', 'standard');
        
      if (sectionsError) {
        console.error('Błąd pobierania sekcji:', sectionsError);
        return;
      }
      
      // Pobierz mapowania kont do sekcji
      const { data: accountMappings, error: mappingError } = await supabase
        .from('account_section_mappings')
        .select('*')
        .eq('report_type', 'standard');
        
      if (mappingError) {
        console.error('Błąd pobierania mapowań kont:', mappingError);
      }
      
      // Utwórz mapę mapowań kont do sekcji
      const sectionMap = new Map();
      if (accountMappings) {
        for (const mapping of accountMappings) {
          sectionMap.set(mapping.account_prefix, mapping.section_id);
        }
      }
      
      // Przygotuj agregaty dla każdego konta
      const aggregates = {};
      
      // Przetwarzaj transakcje
      for (const transaction of transactions) {
        // Znajdź konto debetowe
        const debitAccount = accounts.find(acc => acc.id === transaction.debit_account_id);
        // Znajdź konto kredytowe
        const creditAccount = accounts.find(acc => acc.id === transaction.credit_account_id);
        
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
        
        // Debit account - add to debit turnover and closing
        aggregates[debitAccount.number].debit_turnover += amount;
        if (debitAccount.type === 'bilansowe') {
          aggregates[debitAccount.number].debit_closing += amount;
        }
        
        // Credit account - add to credit turnover and closing
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
        
        // Dodaj wpis
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
      
      console.log(`Przygotowano ${entriesToInsert.length} wpisów do zapisania`);
      
      // Zapisuj wpisy pojedynczo, aby obejść ograniczenia RLS
      for (const entry of entriesToInsert) {
        try {
          const { error } = await supabase
            .from('report_entries')
            .insert(entry);
            
          if (error) {
            console.error(`Błąd zapisywania wpisu dla konta ${entry.account_number}:`, error);
          }
        } catch (error) {
          console.error(`Wyjątek podczas zapisywania wpisu dla konta ${entry.account_number}:`, error);
        }
      }
      
      console.log('Zakończono inicjalizację wpisów raportu');
      
    } catch (error) {
      console.error('Błąd podczas inicjalizacji wpisów raportu:', error);
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
  
  // Rendering głównego komponentu - uproszczony, tylko z podsumowaniem
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
      
      {/* Sekcja podsumowania */}
      <div className="mt-0">
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
    </div>
  );
};

export default ReportDetailsComponent;
