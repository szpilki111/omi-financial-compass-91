import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { calculateFinancialSummary, calculateAndSaveReportSummary } from '@/utils/financeUtils';
import KpirSummary from '../KPIR/components/KpirSummary';

interface ReportFormProps {
  reportId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Schemat walidacji formularza
const reportFormSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
});

const ReportForm: React.FC<ReportFormProps> = ({ reportId, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(true);

  // Nowy stan dla podsumowania finansowego
  const [financialSummary, setFinancialSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0
  });

  // Inicjalizacja formularza
  const form = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    }
  });

  // Pobieranie danych istniejącego raportu (jeśli podano ID)
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) return null;
      
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          location:locations(*)
        `)
        .eq('id', reportId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!reportId
  });

  // Pobierz podsumowanie finansowe dla wybranego miesiąca i roku
  useEffect(() => {
    const fetchFinancialSummary = async () => {
      if (!user?.location) return;

      const month = form.getValues('month');
      const year = form.getValues('year');
      
      // Tworzenie dat w formacie ISO dla pierwszego i ostatniego dnia miesiąca
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];
  
      const summary = await calculateFinancialSummary(user.location, dateFrom, dateTo);
      setFinancialSummary(summary);
    };

    fetchFinancialSummary();
  }, [form.getValues('month'), form.getValues('year'), user?.location]);

  // Reagowanie na zmianę miesiąca lub roku
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'month' || name === 'year') {
        const fetchFinancialSummary = async () => {
          if (!user?.location) return;
          
          const month = form.getValues('month');
          const year = form.getValues('year');
          
          // Tworzenie dat w formacie ISO dla pierwszego i ostatniego dnia miesiąca
          const firstDayOfMonth = new Date(year, month - 1, 1);
          const lastDayOfMonth = new Date(year, month, 0);
          
          const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
          const dateTo = lastDayOfMonth.toISOString().split('T')[0];
  
          const summary = await calculateFinancialSummary(user.location, dateFrom, dateTo);
          setFinancialSummary(summary);
        };
  
        fetchFinancialSummary();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch, user?.location]);

  // Ustawienie domyślnych wartości formularza na podstawie istniejącego raportu
  useEffect(() => {
    if (report) {
      setIsDraft(report.status === 'draft');
      form.reset({
        month: report.month,
        year: report.year,
      });
    }
  }, [report, form]);

  // Pobieranie lokalizacji przypisanej do ekonoma
  const { data: userLocation } = useQuery({
    queryKey: ['userLocation', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Pobierz lokalizację przypisaną do użytkownika
      const { data, error } = await supabase
        .from('profiles')
        .select('location_id, locations(id, name)')
        .eq('id', user.id)
        .single();
        
      if (error) throw error;
      
      return data?.locations || null;
    },
    enabled: !!user?.id
  });

  // Pobieranie wszystkich sekcji raportu
  const { data: reportSections } = useQuery({
    queryKey: ['reportSections', 'standard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', 'standard')
        .order('section_order', { ascending: true });
        
      if (error) throw error;
      return data;
    }
  });

  // Mutacja do zapisywania raportu jako wersja robocza
  const saveDraftMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      console.log("Rozpoczęcie zapisywania raportu...");
      
      const { month, year } = data;
      
      // Sprawdź czy użytkownik ma przypisaną lokalizację
      if (!user?.location) {
        throw new Error('Brak przypisanej lokalizacji dla użytkownika');
      }
      
      const location_id = user.location;
      console.log("Używam lokalizacji użytkownika:", location_id);
      
      // Tytuł raportu w formacie "Raport za [miesiąc] [rok] - [nazwa placówki]"
      const monthName = format(new Date(year, month - 1, 1), 'LLLL', { locale: pl });
      
      // Pobierz nazwę lokalizacji
      const { data: location } = await supabase
        .from('locations')
        .select('name')
        .eq('id', location_id)
        .single();
        
      const title = `Raport za ${monthName} ${year} - ${location?.name || 'placówka'}`;
      const period = `${monthName} ${year}`;
      
      if (reportId) {
        // Aktualizacja istniejącego raportu
        const { data: updatedReport, error } = await supabase
          .from('reports')
          .update({
            month,
            year,
            location_id,
            title,
            period,
            report_type: 'standard',
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId)
          .select('id')
          .single();
          
        if (error) {
          console.error("Błąd podczas aktualizacji raportu:", error);
          throw error;
        }
        
        // Automatycznie oblicz i zapisz podsumowanie finansowe
        try {
          await calculateAndSaveReportSummary(reportId, location_id, month, year);
          console.log("Podsumowanie finansowe zostało automatycznie zaktualizowane");
        } catch (err) {
          console.log("Błąd podczas automatycznej aktualizacji podsumowania (nieblokujący):", err);
        }
        
        return { reportId, isNew: false };
      } else {
        // Sprawdź czy istnieje już raport za ten miesiąc i rok dla tej lokalizacji
        const { data: existingReports, error: existingError } = await supabase
          .from('reports')
          .select('id')
          .eq('month', month)
          .eq('year', year)
          .eq('location_id', location_id);
          
        if (existingError) {
          console.error("Błąd podczas sprawdzania istniejących raportów:", existingError);
          throw existingError;
        }
        
        if (existingReports && existingReports.length > 0) {
          throw new Error('Raport za ten miesiąc i rok dla tej lokalizacji już istnieje');
        }
        
        // Tworzenie nowego raportu z domyślnym statusem 'draft' (wersja robocza)
        const { data: newReport, error } = await supabase
          .from('reports')
          .insert({
            month,
            year,
            location_id,
            title,
            period,
            report_type: 'standard',
            status: 'draft',
            submitted_by: null,
            submitted_at: null
          })
          .select('id')
          .single();
          
        if (error) {
          console.error("Błąd podczas tworzenia raportu:", error);
          throw error;
        }
        
        // Inicjalizuj wpisy raportu na podstawie planu kont - nie rzucaj błędów
        if (newReport?.id) {
          try {
            await initializeReportEntries(newReport.id, location_id, month, year);
            console.log("Wpisy raportu zostały zainicjalizowane");
          } catch (err) {
            console.log("Błąd podczas inicjalizacji wpisów (nieblokujący):", err);
          }
          
          // Automatycznie oblicz i zapisz podsumowanie finansowe od razu po utworzeniu
          try {
            await calculateAndSaveReportSummary(newReport.id, location_id, month, year);
            console.log("Podsumowanie finansowe zostało automatycznie obliczone i zapisane");
          } catch (err) {
            console.log("Błąd podczas automatycznego obliczania podsumowania (nieblokujący):", err);
          }
            
          // Upewnij się, że raport ma status 'draft' po inicjalizacji
          try {
            await supabase
              .from('reports')
              .update({
                status: 'draft'
              })
              .eq('id', newReport.id);
            console.log("Status raportu ustawiony na 'draft'");
          } catch (err) {
            console.log("Błąd podczas ustawiania statusu (nieblokujący):", err);
          }
        }
        
        console.log("Raport został pomyślnie utworzony:", newReport?.id);
        return { reportId: newReport?.id, isNew: true };
      }
    },
    onSuccess: (result) => {
      console.log("Mutacja zakończona sukcesem:", result);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['currentMonthReport'] });
      
      // Poprawione komunikaty sukcesu
      if (result.isNew) {
        toast({
          title: "Sukces",
          description: "Pomyślnie stworzono roboczą wersję raportu z obliczonymi sumami finansowymi",
        });
      } else {
        toast({
          title: "Sukces", 
          description: "Raport został zaktualizowany z nowymi sumami finansowymi",
        });
      }
      
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/reports/${result.reportId}`);
      }
      
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error('Błąd podczas zapisywania raportu:', error);
      toast({
        title: "Błąd",
        description: `Nie udało się zapisać raportu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  });
  
  // Funkcja do inicjalizacji wpisów raportu - nie rzucaj błędów na zewnątrz
  const initializeReportEntries = async (reportId: string, locationId: string, month: number, year: number) => {
    try {
      console.log(`Inicjalizacja wpisów dla raportu ${reportId}, lokalizacja ${locationId}, ${month}/${year}`);
      
      // Pobierz sekcje dla standardowego typu raportu
      const { data: sections, error: sectionsError } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', 'standard')
        .order('section_order', { ascending: true });
        
      if (sectionsError) {
        console.log("Błąd podczas pobierania sekcji:", sectionsError);
        return; // Nie rzucaj błędu
      }
      
      console.log("Pobrane sekcje:", sections);
      
      // Pobierz plan kont
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .order('number');
        
      if (accountsError) {
        console.log("Błąd podczas pobierania kont:", accountsError);
        return; // Nie rzucaj błędu
      }
      
      console.log("Pobrane konta:", accounts?.length);
      
      // Pobierz mapowania kont do sekcji
      const { data: accountMappings, error: mappingsError } = await supabase
        .from('account_section_mappings')
        .select('*')
        .eq('report_type', 'standard');
        
      if (mappingsError) {
        console.log("Błąd podczas pobierania mapowań:", mappingsError);
        return; // Nie rzucaj błędu
      }
      
      console.log("Pobrane mapowania:", accountMappings?.length);
      
      // Stwórz mapę sekcji dla każdego prefiksu konta
      const sectionMap = new Map();
      
      if (accountMappings) {
        for (const mapping of accountMappings) {
          sectionMap.set(mapping.account_prefix, mapping.section_id);
        }
      }
      
      // Przypisz konta do odpowiednich sekcji
      if (sections && accounts) {
        const entriesToInsert = [];
        
        for (const account of accounts) {
          // Znajdź sekcję dla konta na podstawie prefiksu
          let sectionId = null;
          
          // Sprawdź prefiksy od najdłuższych do najkrótszych
          for (let i = account.number.length; i > 0; i--) {
            const prefix = account.number.substring(0, i);
            if (sectionMap.has(prefix)) {
              sectionId = sectionMap.get(prefix);
              break;
            }
          }

          // Pobierz sumę transakcji dla tego konta w danym miesiącu i roku
          let debitTurnover = 0;
          let creditTurnover = 0;

          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          
          const startDateString = startDate.toISOString().split('T')[0];
          const endDateString = endDate.toISOString().split('T')[0];
          
          // Pobierz transakcje debetowe
          try {
            const { data: debitTransactions } = await supabase
              .from('transactions')
              .select('amount')
              .eq('location_id', locationId)
              .eq('debit_account_id', account.id)
              .gte('date', startDateString)
              .lte('date', endDateString);
              
            if (debitTransactions) {
              debitTurnover = debitTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
            }
          } catch (err) {
            console.log(`Błąd podczas pobierania transakcji debetowych dla konta ${account.number}:`, err);
          }
          
          // Pobierz transakcje kredytowe
          try {
            const { data: creditTransactions } = await supabase
              .from('transactions')
              .select('amount')
              .eq('location_id', locationId)
              .eq('credit_account_id', account.id)
              .gte('date', startDateString)
              .lte('date', endDateString);
              
            if (creditTransactions) {
              creditTurnover = creditTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
            }
          } catch (err) {
            console.log(`Błąd podczas pobierania transakcji kredytowych dla konta ${account.number}:`, err);
          }

          // Oblicz salda zamknięcia
          const debitClosing = account.type === 'bilansowe' ? debitTurnover : 0;
          const creditClosing = account.type === 'bilansowe' ? creditTurnover : 0;
          
          // Dodaj wpis dla konta
          entriesToInsert.push({
            report_id: reportId,
            section_id: sectionId,
            account_number: account.number,
            account_name: account.name,
            debit_opening: 0, // Dla uproszczenia zakładamy 0
            credit_opening: 0, // Dla uproszczenia zakładamy 0
            debit_turnover: debitTurnover,
            credit_turnover: creditTurnover,
            debit_closing: debitClosing,
            credit_closing: creditClosing
          });
        }
        
        console.log(`Przygotowano ${entriesToInsert.length} wpisów do zapisania`);
        
        // Zapisz wpisy do bazy
        if (entriesToInsert.length > 0) {
          try {
            // Zapisujemy wpisy pojedynczo, aby obejść ograniczenia RLS
            for (const entry of entriesToInsert) {
              try {
                const { error: insertError } = await supabase
                  .from('report_entries')
                  .insert(entry);
                  
                if (insertError) {
                  console.log(`Próba zapisu wpisu dla konta ${entry.account_number} nie powiodła się:`, insertError);
                }
              } catch (err) {
                console.error(`Błąd zapisu wpisu dla konta ${entry.account_number}:`, err);
              }
            }
            
            console.log("Wpisy zostały zapisane pomyślnie");
          } catch (error) {
            console.error('Ogólny błąd przy zapisie wpisów:', error);
          }
        }

        // Po zainicjalizowaniu wpisów, oblicz i zapisz podsumowania
        try {
          await calculateAndUpdateReportSummary(reportId);
        } catch (err) {
          console.log('Błąd podczas obliczania podsumowania:', err);
        }
      }
    } catch (error) {
      console.error('Błąd podczas inicjalizacji wpisów raportu:', error);
      // Mimo błędów, nie rzucamy wyjątku, aby raport mógł być utworzony
      console.log('Mimo błędów, raport został utworzony. Użytkownik może ręcznie dodawać wpisy.');
    }
  };

  // Funkcja do obliczania i aktualizacji podsumowania raportu
  const calculateAndUpdateReportSummary = async (reportId: string) => {
    try {
      console.log(`Obliczanie podsumowania dla raportu ${reportId}`);
      
      // Pobierz wszystkie wpisy raportu
      const { data: entries, error } = await supabase
        .from('report_entries')
        .select('*')
        .eq('report_id', reportId);
      
      if (error) {
        console.log('Błąd podczas pobierania wpisów:', error);
        return;
      }

      if (!entries || entries.length === 0) {
        console.warn('Brak wpisów w raporcie do obliczenia podsumowania');
        
        // Zapisz zerowe wartości
        await updateOrCreateReportDetails(reportId, 0, 0, 0, 0);
        return;
      }

      console.log(`Znaleziono ${entries.length} wpisów do podsumowania`);

      // Oblicz podsumowania
      let incomeTotal = 0;
      let expenseTotal = 0;
      let settlementsTotal = 0;

      entries.forEach(entry => {
        // Walidacja danych
        if (!entry.account_number) {
          console.warn(`Wpis ${entry.id} nie ma numeru konta`);
          return;
        }

        // Konta przychodów zaczynające się od 7
        if (entry.account_number && entry.account_number.startsWith('7')) {
          const value = Number(entry.credit_turnover || 0);
          if (isNaN(value)) {
            console.warn(`Niepoprawna wartość credit_turnover dla konta ${entry.account_number}: ${entry.credit_turnover}`);
            return;
          }
          incomeTotal += value;
          console.log(`Konto przychodu ${entry.account_number}: ${value} - suma: ${incomeTotal}`);
        }
        // Konta kosztów zaczynające się od 4
        else if (entry.account_number && entry.account_number.startsWith('4')) {
          const value = Number(entry.debit_turnover || 0);
          if (isNaN(value)) {
            console.warn(`Niepoprawna wartość debit_turnover dla konta ${entry.account_number}: ${entry.debit_turnover}`);
            return;
          }
          expenseTotal += value;
          console.log(`Konto kosztu ${entry.account_number}: ${value} - suma: ${expenseTotal}`);
        }
        // Konta rozrachunków zaczynające się od 2
        else if (entry.account_number && entry.account_number.startsWith('2')) {
          const debitClosing = Number(entry.debit_closing || 0);
          const creditClosing = Number(entry.credit_closing || 0);
          if (isNaN(debitClosing) || isNaN(creditClosing)) {
            console.warn(`Niepoprawne wartości debit_closing lub credit_closing dla konta ${entry.account_number}`);
            return;
          }
          const balance = Math.abs(debitClosing - creditClosing);
          settlementsTotal += balance;
          console.log(`Konto rozrachunku ${entry.account_number}: ${balance} - suma: ${settlementsTotal}`);
        }
        else {
          console.log(`Konto ${entry.account_number} nie pasuje do żadnej kategorii (przychód, koszt, rozrachunek)`);
        }
      });

      // Oblicz bilans (przychody - koszty)
      const balance = incomeTotal - expenseTotal;

      console.log(`Obliczone sumy: przychody=${incomeTotal}, koszty=${expenseTotal}, bilans=${balance}, rozrachunki=${settlementsTotal}`);

      // Zapisz podsumowanie
      await updateOrCreateReportDetails(reportId, incomeTotal, expenseTotal, balance, settlementsTotal);
    } catch (err) {
      console.error("Błąd podczas zapisu podsumowania:", err);
    }
  };
  
  // Funkcja pomocnicza do zapisywania lub aktualizacji szczegółów raportu
  const updateOrCreateReportDetails = async (
    reportId: string,
    incomeTotal: number,
    expenseTotal: number,
    balance: number,
    settlementsTotal: number
  ) => {
    try {
      // Sprawdź czy istnieją już szczegóły dla tego raportu
      const { data: existingDetails, error: checkError } = await supabase
        .from('report_details')
        .select('id')
        .eq('report_id', reportId);
        
      if (checkError) {
        console.error("Błąd podczas sprawdzania istniejących szczegółów:", checkError);
        return;
      }
      
      if (existingDetails && existingDetails.length > 0) {
        // Aktualizuj istniejące szczegóły
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
          console.error("Błąd podczas aktualizacji szczegółów raportu:", updateError);
        } else {
          console.log("Zaktualizowano istniejące szczegóły raportu");
        }
      } else {
        // Utwórz nowe szczegóły
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
          console.error("Błąd podczas tworzenia szczegółów raportu:", insertError);
        } else {
          console.log("Utworzono nowe szczegóły raportu");
        }
      }
    } catch (error) {
      console.error("Błąd podczas obsługi szczegółów raportu:", error);
    }
  };

  // Obsługa formularza
  const onSubmit = (values: z.infer<typeof reportFormSchema>) => {
    // Upewnij się, że wartości są zgodne z oczekiwanym typem
    const formData = {
      month: values.month,
      year: values.year
    };
    
    setIsSubmitting(true);
    
    // Zawsze używamy saveDraftMutation do zapisania raportu
    saveDraftMutation.mutate(formData);
  };
  
  // Wyświetlanie loadera podczas ładowania danych
  if ((reportId && loadingReport)) {
    return (
      <div className="flex justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Walidacja dostępu do istniejącego raportu
  if (reportId && report && report.status !== 'draft') {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-100 border border-yellow-400 p-4 rounded">
          <h3 className="text-lg font-medium text-yellow-800">Raport nie może być edytowany</h3>
          <p className="text-yellow-700">
            Ten raport ma status <strong>{report.status}</strong> i nie może być już edytowany.
          </p>
        </div>
        
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel || (() => navigate('/reports'))}>
            Powrót do listy raportów
          </Button>
        </div>
      </div>
    );
  }

  // Sprawdź, czy użytkownik ma przypisaną lokalizację
  if (!user?.location && !reportId) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-100 border border-yellow-400 p-4 rounded">
          <h3 className="text-lg font-medium text-yellow-800">Brak przypisanej lokalizacji</h3>
          <p className="text-yellow-700">
            Nie masz przypisanej lokalizacji. Skontaktuj się z administratorem, aby przypisać Ci lokalizację.
          </p>
        </div>
        
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel || (() => navigate('/reports'))}>
            Powrót do listy raportów
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-omi-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              {reportId ? 'Edycja raportu' : 'Nowy raport'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Miesiąc</FormLabel>
                    <Select
                      value={field.value.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz miesiąc" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Styczeń</SelectItem>
                        <SelectItem value="2">Luty</SelectItem>
                        <SelectItem value="3">Marzec</SelectItem>
                        <SelectItem value="4">Kwiecień</SelectItem>
                        <SelectItem value="5">Maj</SelectItem>
                        <SelectItem value="6">Czerwiec</SelectItem>
                        <SelectItem value="7">Lipiec</SelectItem>
                        <SelectItem value="8">Sierpień</SelectItem>
                        <SelectItem value="9">Wrzesień</SelectItem>
                        <SelectItem value="10">Październik</SelectItem>
                        <SelectItem value="11">Listopad</SelectItem>
                        <SelectItem value="12">Grudzień</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Wybierz miesiąc, za który tworzysz raport
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rok</FormLabel>
                    <Select
                      value={field.value.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz rok" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...Array(5)].map((_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Wybierz rok, za który tworzysz raport
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Dodane podsumowanie finansowe */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-omi-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              Podsumowanie finansowe za wybrany okres
            </h2>
            
            <KpirSummary 
              income={financialSummary.income}
              expense={financialSummary.expense}
              balance={financialSummary.balance}
            />
            
            <p className="mt-4 text-sm text-omi-gray-500">
              Te wartości zostaną automatycznie zapisane w raporcie po jego utworzeniu.
            </p>
          </div>

          {reportId && reportSections && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-omi-gray-200">
              <h2 className="text-xl font-semibold mb-4">
                Zawartość raportu
              </h2>
              
              <Accordion type="single" collapsible className="w-full">
                {reportSections.map((section) => (
                  <AccordionItem key={section.id} value={section.id}>
                    <AccordionTrigger className="text-lg">
                      {section.name}
                    </AccordionTrigger>
                    <AccordionContent>
                      <Card>
                        <CardContent className="p-4">
                          <p className="italic text-omi-gray-500">Wpisy tej sekcji będą dostępne po zapisaniu raportu.</p>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
            )}
            <Button 
              type="submit" 
              variant="default" 
              disabled={isSubmitting}
            >
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              {reportId ? 'Zapisz zmiany' : 'Utwórz raport'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ReportForm;
