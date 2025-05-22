
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
      const { month, year } = data;
      
      // Użyj lokalizacji użytkownika
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
        const { error } = await supabase
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
          .eq('id', reportId);
          
        if (error) throw error;
        
        return reportId;
      } else {
        // Tworzenie nowego raportu
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
          
        if (error) throw error;
        
        // Inicjalizuj wpisy raportu na podstawie planu kont
        if (newReport?.id) {
          await initializeReportEntries(newReport.id, location_id, month, year);
        }
        
        return newReport?.id;
      }
    },
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
    onSuccess: (newReportId) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: reportId ? "Raport zaktualizowany" : "Raport utworzony",
        description: "Raport został zapisany jako wersja robocza",
      });
      
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/reports/${newReportId}`);
      }
    },
    onError: (error) => {
      console.error('Błąd podczas zapisywania raportu:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać raportu. Spróbuj ponownie później.",
        variant: "destructive",
      });
    }
  });
  
  // Mutacja do składania raportu
  const submitReportMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      try {
        // Najpierw zapisz jako wersja robocza, aby utworzyć raport jeśli to nowy
        const reportId = await saveDraftMutation.mutateAsync(data);
        
        // Teraz zaktualizuj status raportu na 'submitted'
        const { error } = await supabase
          .from('reports')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            submitted_by: user.id
          })
          .eq('id', reportId);
          
        if (error) throw error;
  
        // Oblicz i zaktualizuj podsumowania raportu
        await calculateAndUpdateReportSummary(reportId);
        
        // Wyślij powiadomienie do prowincjała
        const { data: admins, error: adminsError } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'prowincjal']);
          
        if (!adminsError && admins) {
          // Pobierz nazwę lokalizacji
          const { data: location } = await supabase
            .from('locations')
            .select('name')
            .eq('id', user.location)
            .single();
            
          const monthName = format(new Date(data.year, data.month - 1, 1), 'LLLL', { locale: pl });
          
          for (const admin of admins) {
            await supabase
              .from('notifications')
              .insert({
                user_id: admin.id,
                title: 'Złożono nowy raport',
                message: `Raport za ${monthName} ${data.year} - ${location?.name} został złożony i oczekuje na sprawdzenie.`,
                priority: 'medium',
                action_label: 'Zobacz raport',
                action_link: `/reports/${reportId}`
              });
          }
        }
        
        return reportId;
      } catch (error) {
        console.error('Błąd przy składaniu raportu:', error);
        throw error;
      }
    },
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
    onSuccess: (newReportId) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: "Raport złożony",
        description: "Raport został złożony do zatwierdzenia",
      });
      
      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/reports/${newReportId}`);
      }
    },
    onError: (error) => {
      console.error('Błąd podczas składania raportu:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się złożyć raportu. Spróbuj ponownie później.",
        variant: "destructive",
      });
    }
  });
  
  // Funkcja do inicjalizacji wpisów raportu
  const initializeReportEntries = async (reportId: string, locationId: string, month: number, year: number) => {
    try {
      console.log(`Inicjalizacja wpisów dla raportu ${reportId}, lokalizacja ${locationId}, ${month}/${year}`);
      
      // Pobierz sekcje dla standardowego typu raportu
      const { data: sections, error: sectionsError } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', 'standard')
        .order('section_order', { ascending: true });
        
      if (sectionsError) throw sectionsError;
      console.log("Pobrane sekcje:", sections);
      
      // Pobierz plan kont
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .order('number');
        
      if (accountsError) throw accountsError;
      console.log("Pobrane konta:", accounts?.length);
      
      // Pobierz mapowania kont do sekcji
      const { data: accountMappings, error: mappingsError } = await supabase
        .from('account_section_mappings')
        .select('*')
        .eq('report_type', 'standard');
        
      if (mappingsError) throw mappingsError;
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
          
          // Pobierz transakcje kredytowe
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
          const { error: insertError } = await supabase
            .from('report_entries')
            .insert(entriesToInsert);
            
          if (insertError) throw insertError;
          console.log("Wpisy zostały zapisane pomyślnie");
        }

        // Po zainicjalizowaniu wpisów, oblicz i zapisz podsumowania
        await calculateAndUpdateReportSummary(reportId);
      }
    } catch (error) {
      console.error('Błąd podczas inicjalizacji wpisów raportu:', error);
      throw new Error('Nie udało się zainicjalizować wpisów raportu');
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
      
      if (error) throw error;

      if (!entries || entries.length === 0) {
        console.warn('Brak wpisów w raporcie do obliczenia podsumowania');
        // Utworzenie pustego podsumowania
        const { error: insertEmptyError } = await supabase
          .from('report_details')
          .insert({
            report_id: reportId,
            income_total: 0,
            expense_total: 0,
            balance: 0,
            settlements_total: 0
          });
        
        if (insertEmptyError) throw insertEmptyError;
        console.log('Utworzono puste podsumowanie dla raportu bez wpisów');
        return;
      }

      console.log(`Znaleziono ${entries.length} wpisów do podsumowania`);

      // Oblicz podsumowania
      let incomeTotal = 0;
      let expenseTotal = 0;
      let settlementsTotal = 0;

      entries.forEach(entry => {
        // Konta przychodów zaczynające się od 7
        if (entry.account_number.startsWith('7')) {
          incomeTotal += Number(entry.credit_turnover || 0);
          console.log(`Konto przychodu ${entry.account_number}: ${entry.credit_turnover} - suma: ${incomeTotal}`);
        }
        // Konta kosztów zaczynające się od 4
        else if (entry.account_number.startsWith('4')) {
          expenseTotal += Number(entry.debit_turnover || 0);
          console.log(`Konto kosztu ${entry.account_number}: ${entry.debit_turnover} - suma: ${expenseTotal}`);
        }
        // Konta rozrachunków zaczynające się od 2
        else if (entry.account_number.startsWith('2')) {
          const balance = Number(entry.credit_closing || 0) - Number(entry.debit_closing || 0);
          settlementsTotal += balance;
          console.log(`Konto rozrachunku ${entry.account_number}: ${balance} - suma: ${settlementsTotal}`);
        }
      });

      // Oblicz bilans (przychody - koszty)
      const balance = incomeTotal - expenseTotal;

      console.log(`Obliczone sumy: przychody=${incomeTotal}, koszty=${expenseTotal}, bilans=${balance}, rozrachunki=${settlementsTotal}`);

      try {
        // Sprawdź, czy istnieje już rekord podsumowania
        const { data: existingDetails, error: checkError } = await supabase
          .from('report_details')
          .select('id')
          .eq('report_id', reportId);

        if (checkError) throw checkError;
        
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
      } catch (err) {
        console.error("Błąd podczas zapisu podsumowania:", err);
        throw err;
      }
      
      console.log('Podsumowanie zostało pomyślnie zaktualizowane');
    } catch (error) {
      console.error('Błąd podczas aktualizacji podsumowania raportu:', error);
      throw new Error('Nie udało się zaktualizować podsumowania raportu');
    }
  };

  // Obsługa formularza
  const onSubmit = (values: z.infer<typeof reportFormSchema>) => {
    // Sprawdź, czy raport o tym samym miesiącu, roku i lokalizacji już istnieje
    const checkExistingReport = async () => {
      if (reportId) return false; // Jeśli edytujemy istniejący raport, pomijamy sprawdzenie
      
      if (!user?.location) {
        toast({
          title: "Błąd",
          description: "Nie masz przypisanej lokalizacji. Skontaktuj się z administratorem.",
          variant: "destructive",
        });
        return true; // Zwracamy true, aby zatrzymać tworzenie raportu
      }
      
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('month', values.month)
        .eq('year', values.year)
        .eq('location_id', user.location);
        
      if (error) {
        console.error('Błąd podczas sprawdzania istniejących raportów:', error);
        return false;
      }
      
      return data && data.length > 0;
    };
    
    checkExistingReport().then(exists => {
      if (exists) {
        toast({
          title: "Raport już istnieje",
          description: "Raport za ten miesiąc i rok dla wybranej lokalizacji już istnieje.",
          variant: "destructive",
        });
        return;
      }
      
      // Upewnij się, że wartości są zgodne z oczekiwanym typem
      const formData = {
        month: values.month,
        year: values.year
      };
      
      if (isDraft) {
        saveDraftMutation.mutate(formData);
      } else {
        submitReportMutation.mutate(formData);
      }
    });
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
              variant="outline" 
              onClick={() => setIsDraft(true)}
              disabled={isSubmitting}
            >
              {isSubmitting && isDraft && <Spinner className="mr-2 h-4 w-4" />}
              Zapisz jako wersję roboczą
            </Button>
            <Button 
              type="submit" 
              variant="default" 
              onClick={() => setIsDraft(false)}
              disabled={isSubmitting}
            >
              {isSubmitting && !isDraft && <Spinner className="mr-2 h-4 w-4" />}
              {reportId ? 'Zapisz i złóż raport' : 'Utwórz i złóż raport'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ReportForm;
