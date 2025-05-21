
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const months = [
  { value: 1, label: 'Styczeń' },
  { value: 2, label: 'Luty' },
  { value: 3, label: 'Marzec' },
  { value: 4, label: 'Kwiecień' },
  { value: 5, label: 'Maj' },
  { value: 6, label: 'Czerwiec' },
  { value: 7, label: 'Lipiec' },
  { value: 8, label: 'Sierpień' },
  { value: 9, label: 'Wrzesień' },
  { value: 10, label: 'Październik' },
  { value: 11, label: 'Listopad' },
  { value: 12, label: 'Grudzień' },
];

const reportTypes = [
  { value: 'standard', label: 'Standardowy' },
  { value: 'zos', label: 'Zestawienie Obrotów i Sald (ZOS)' },
  { value: 'bilans', label: 'Bilans' },
  { value: 'rzis', label: 'Rachunek Zysków i Strat (RZiS)' },
  { value: 'jpk', label: 'Jednolity Plik Kontrolny (JPK)' },
  { value: 'analiza', label: 'Analiza Kosztów i Przychodów' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

interface ReportFormProps {
  reportId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const formSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  location_id: z.string().uuid(),
  report_type: z.enum(['standard', 'zos', 'bilans', 'rzis', 'jpk', 'analiza'])
});

const ReportForm: React.FC<ReportFormProps> = ({ reportId, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pobieranie placówek
  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data: userRole } = await supabase.rpc('get_user_role');
      
      if (userRole === 'admin' || userRole === 'provincial') {
        // Admin i prowincjał widzą wszystkie placówki
        const { data, error } = await supabase.from('locations').select('*');
        if (error) throw error;
        return data;
      } else {
        // Ekonom widzi tylko swoją placówkę
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        if (!locationId) throw new Error("Nie można określić lokalizacji użytkownika");
        
        const { data, error } = await supabase.from('locations').select('*').eq('id', locationId);
        if (error) throw error;
        return data;
      }
    }
  });

  // Pobieranie danych raportu, jeśli edytujemy istniejący
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) return null;
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();
        
      if (error) throw error;
      return data as Report;
    },
    enabled: !!reportId
  });
  
  // Inicjalizacja formularza
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      location_id: '',
      report_type: 'standard',
    },
  });

  // Aktualizacja wartości formularza, gdy dane raportu są dostępne
  useEffect(() => {
    if (report) {
      form.reset({
        month: report.month,
        year: report.year,
        location_id: report.location_id,
        report_type: report.report_type || 'standard',
      });
    }
  }, [report, form]);
  
  // Sprawdzenie, czy mamy tylko jedną lokalizację (dla ekonoma)
  useEffect(() => {
    if (locations?.length === 1) {
      form.setValue('location_id', locations[0].id);
    }
  }, [locations, form]);

  // Mutacja do zapisywania/aktualizacji raportu
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { month, year, location_id, report_type } = values;
      
      // Pobranie nazwy lokalizacji
      const { data: locationData } = await supabase
        .from('locations')
        .select('name')
        .eq('id', location_id)
        .single();
        
      if (!locationData) {
        throw new Error("Nie można znaleźć lokalizacji");
      }
      
      const reportTypeLabel = reportTypes.find(t => t.value === report_type)?.label || '';
      const monthName = months.find(m => m.value === month)?.label || '';
      const title = `${reportTypeLabel} ${monthName} ${year} - ${locationData.name}`;
      const period = `${monthName} ${year}`;
      
      if (reportId) {
        // Aktualizacja istniejącego raportu
        const { error } = await supabase
          .from('reports')
          .update({
            month,
            year,
            location_id,
            report_type,
            title,
            period,
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);
          
        if (error) throw error;
        return { id: reportId };
      } else {
        // Tworzenie nowego raportu - upewniamy się, że status ma prawidłową wartość
        const { data, error } = await supabase
          .from('reports')
          .insert({
            month,
            year,
            location_id,
            report_type,
            title,
            period,
            status: 'draft' // Upewniamy się, że używamy poprawnej wartości statusu
          })
          .select('id')
          .single();
          
        if (error) {
          console.error('Błąd wstawiania raportu:', error);
          throw error;
        }
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: reportId ? "Raport zaktualizowany" : "Raport utworzony",
        description: reportId 
          ? "Zmiany zostały zapisane pomyślnie." 
          : "Nowy raport został utworzony pomyślnie.",
        variant: "default",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      console.error('Błąd mutacji:', error);
      toast({
        title: "Błąd",
        description: `Nie udało się ${reportId ? 'zaktualizować' : 'utworzyć'} raportu: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutacja do zmiany statusu raportu na 'złożony'
  const submitReportMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("Brak ID raportu");
      
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', reportId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast({
        title: "Raport złożony",
        description: "Raport został pomyślnie złożony do zatwierdzenia.",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error('Błąd zmiany statusu:', error);
      toast({
        title: "Błąd",
        description: `Nie udało się złożyć raportu: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      console.error('Błąd podczas zapisywania:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportId) return;
    await submitReportMutation.mutateAsync();
  };

  // Pokazuj spinner podczas ładowania danych
  if ((reportId && loadingReport) || loadingLocations) {
    return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Miesiąc</FormLabel>
                <Select
                  value={field.value.toString()}
                  onValueChange={value => field.onChange(parseInt(value))}
                  disabled={report?.status !== 'draft' && !!report}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz miesiąc" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onValueChange={value => field.onChange(parseInt(value))}
                  disabled={report?.status !== 'draft' && !!report}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz rok" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="location_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Placówka</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={(locations?.length === 1) || (report?.status !== 'draft' && !!report)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz placówkę" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations?.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="report_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ raportu</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={report?.status !== 'draft' && !!report}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz typ raportu" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {reportTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {report && (
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-omi-gray-500">Status:</p>
                <p className="font-medium">{
                  report.status === 'draft' ? 'Roboczy' : 
                  report.status === 'submitted' ? 'Złożony' : 
                  report.status === 'accepted' ? 'Zaakceptowany' : 
                  report.status === 'rejected' ? 'Odrzucony' : report.status
                }</p>
              </div>
              {report.submitted_at && (
                <div>
                  <p className="text-omi-gray-500">Data złożenia:</p>
                  <p className="font-medium">{format(new Date(report.submitted_at), 'PPP', { locale: pl })}</p>
                </div>
              )}
            </div>
            {report.comments && (
              <div className="mt-4">
                <p className="text-omi-gray-500">Komentarz:</p>
                <p className="bg-omi-gray-100 p-2 rounded mt-1">{report.comments}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Anuluj
            </Button>
          )}
          
          {report && report.status === 'draft' && (
            <Button 
              type="button" 
              onClick={handleSubmitReport}
              disabled={submitReportMutation.isPending}
            >
              {submitReportMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
              Złóż raport
            </Button>
          )}
          
          {(!report || report.status === 'draft') && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Zapisz
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};

export default ReportForm;
