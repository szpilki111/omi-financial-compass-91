import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { calculateAndSaveReportSummary } from '@/utils/financeUtils';

const reportFormSchema = z.object({
  month: z.string().min(1, 'Miesiąc jest wymagany'),
  year: z.string().min(1, 'Rok jest wymagany'),
  showFromYearStart: z.boolean().default(false)
});

interface ReportFormProps {
  reportId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const months = [
  { value: '1', label: 'Styczeń' },
  { value: '2', label: 'Luty' },
  { value: '3', label: 'Marzec' },
  { value: '4', label: 'Kwiecień' },
  { value: '5', label: 'Maj' },
  { value: '6', label: 'Czerwiec' },
  { value: '7', label: 'Lipiec' },
  { value: '8', label: 'Sierpień' },
  { value: '9', label: 'Wrzesień' },
  { value: '10', label: 'Październik' },
  { value: '11', label: 'Listopad' },
  { value: '12', label: 'Grudzień' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

const ReportForm: React.FC<ReportFormProps> = ({ reportId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const form = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      month: new Date().getMonth() + 1 + '',
      year: new Date().getFullYear() + '',
      showFromYearStart: false
    }
  });

  const [selectedMonth, selectedYear, showFromYearStart] = form.watch(['month', 'year', 'showFromYearStart']);
  
  const [financialSummary, setFinancialSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0,
    openingBalance: 0
  });

  // Oblicz podsumowanie finansowe na podstawie wybranych parametrów
  React.useEffect(() => {
    const calculatePreview = async () => {
      if (!selectedMonth || !selectedYear || !user?.location) return;
      
      setIsCalculating(true);
      try {
        const month = parseInt(selectedMonth);
        const year = parseInt(selectedYear);
        
        // Pobierz saldo otwarcia
        const { getOpeningBalance, calculateFinancialSummary } = await import('@/utils/financeUtils');
        const openingBalance = await getOpeningBalance(user.location, month, year);
        
        // Oblicz daty
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);
        const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        const dateTo = lastDayOfMonth.toISOString().split('T')[0];
        
        // Oblicz podsumowanie finansowe
        const summary = await calculateFinancialSummary(user.location, dateFrom, dateTo);
        
        setFinancialSummary({
          ...summary,
          openingBalance
        });
      } catch (error) {
        console.error('Błąd podczas obliczania podglądu:', error);
        setFinancialSummary({ income: 0, expense: 0, balance: 0, openingBalance: 0 });
      } finally {
        setIsCalculating(false);
      }
    };

    calculatePreview();
  }, [selectedMonth, selectedYear, user?.location]);

  const onSubmit = async (values: z.infer<typeof reportFormSchema>) => {
    if (!user?.location) {
      toast({
        title: "Błąd",
        description: "Nie można określić lokalizacji użytkownika.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    console.log('🚀 ROZPOCZĘCIE TWORZENIA RAPORTU');
    console.log('📝 Dane formularza:', values);

    try {
      const month = parseInt(values.month);
      const year = parseInt(values.year);
      
      // Sprawdź czy raport już istnieje
      console.log('🔍 Sprawdzanie czy raport już istnieje...');
      const { data: existingReport, error: checkError } = await supabase
        .from('reports')
        .select('id, title')
        .eq('location_id', user.location)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Błąd sprawdzania istnienia raportu:', checkError);
        throw checkError;
      }

      if (existingReport) {
        console.log('⚠️ Raport już istnieje:', existingReport);
        toast({
          title: "Raport już istnieje",
          description: `Raport za ${months.find(m => m.value === values.month)?.label} ${values.year} już został utworzony.`,
          variant: "destructive",
        });
        return;
      }

      // Pobierz nazwę lokalizacji
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('name')
        .eq('id', user.location)
        .single();

      if (locationError) {
        console.error('❌ Błąd pobierania danych lokalizacji:', locationError);
        throw locationError;
      }

      // Utwórz nowy raport
      console.log('✨ Tworzenie nowego raportu...');
      const reportTitle = `Raport za ${months.find(m => m.value === values.month)?.label} ${values.year} - ${locationData?.name || 'Nieznana lokalizacja'}`;
      const period = `${months.find(m => m.value === values.month)?.label} ${values.year}`;

      const { data: newReport, error: createError } = await supabase
        .from('reports')
        .insert({
          title: reportTitle,
          period: period,
          month: month,
          year: year,
          location_id: user.location,
          status: 'draft'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Błąd tworzenia raportu:', createError);
        throw createError;
      }

      console.log('✅ Raport utworzony:', newReport);

      // Automatycznie oblicz i zapisz podsumowanie finansowe
      console.log('💰 Obliczanie podsumowania finansowego...');
      try {
        const financialResult = await calculateAndSaveReportSummary(
          newReport.id,
          user.location,
          month,
          year
        );
        console.log('✅ Podsumowanie finansowe obliczone:', financialResult);
      } catch (summaryError) {
        console.warn('⚠️ Błąd obliczania podsumowania finansowego:', summaryError);
        // Nie przerywamy procesu - raport jest już utworzony
      }

      console.log('🎉 RAPORT UTWORZONY POMYŚLNIE!');
      
      toast({
        title: "Sukces",
        description: "Raport został utworzony z obliczonymi sumami finansowymi!",
        variant: "default",
      });

      // Przekieruj do widoku szczegółów raportu
      console.log('🔄 Przekierowanie do szczegółów raportu...');
      navigate(`/reports/${newReport.id}`, { replace: true });
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('❌ BŁĄD PODCZAS TWORZENIA RAPORTU:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas tworzenia raportu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="month"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Miesiąc</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz miesiąc, za który tworzysz raport" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz rok, za który tworzysz raport" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {years.map((year) => (
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
        </div>

        <FormField
          control={form.control}
          name="showFromYearStart"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Pokaż podsumowanie od początku roku
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  Zaznacz, aby zobaczyć dane finansowe za cały rok (tylko podgląd, bez zapisywania)
                </p>
              </div>
            </FormItem>
          )}
        />

        {/* Podgląd podsumowania finansowego */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Podsumowanie finansowe za wybrany miesiąc</h3>
          
          {isCalculating ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" className="mr-2" />
              <span>Obliczanie podsumowania...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Otwarcie miesiąca</h4>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(financialSummary.openingBalance)}
                </p>
                <p className="text-xs text-gray-500">Saldo z poprzedniego miesiąca</p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Przychody</h4>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(financialSummary.income)}
                </p>
                <p className="text-xs text-gray-500">Suma wszystkich przychodów (konta 7xx i 200 po stronie kredytu)</p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Rozchody</h4>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(financialSummary.expense)}
                </p>
                <p className="text-xs text-gray-500">Suma wszystkich kosztów (konta 4xx i 200 po stronie debetu)</p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Saldo końcowe</h4>
                <p className={`text-xl font-bold ${financialSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialSummary.openingBalance + financialSummary.balance)}
                </p>
                <p className="text-xs text-gray-500">Otwarcie + Przychody - Rozchody</p>
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-600 mt-4">
            Te wartości zostaną automatycznie zapisane w raporcie po jego utworzeniu.
          </p>
        </div>

        <div className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Anuluj
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Tworzenie raportu...
              </>
            ) : (
              'Utwórz raport'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ReportForm;
