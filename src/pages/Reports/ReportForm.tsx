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
import { calculateAndSaveReportSummary, getOpeningBalance, calculateFinancialSummary } from '@/utils/financeUtils';
import ReportAccountsBreakdown from '@/components/reports/ReportAccountsBreakdown';
import YearToDateAccountsBreakdown from '@/components/reports/YearToDateAccountsBreakdown';
import YearToDateCashFlowBreakdown from '@/components/reports/YearToDateCashFlowBreakdown';

const reportFormSchema = z.object({
  month: z.string().optional(),
  year: z.string().min(1, 'Rok jest wymagany'),
  periodType: z.enum(['month', 'quarter', 'year']).default('month'),
  quarter: z.string().optional(),
  locationIds: z.array(z.string()).min(1, 'Wybierz przynajmniej jedną lokalizację'),
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
  const [isCalculatingYearToDate, setIsCalculatingYearToDate] = useState(false);

  const [availableLocations, setAvailableLocations] = useState<Array<{ id: string, name: string }>>([]);

  // Pobierz dostępne lokalizacje
  React.useEffect(() => {
    const fetchLocations = async () => {
      const { data: userRole } = await supabase.rpc('get_user_role');
      
      // Admin i prowincjał widzą wszystkie lokalizacje
      if (userRole === 'admin' || userRole === 'prowincjal') {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .order('name');
        
        if (!error && data) {
          setAvailableLocations(data);
        }
      } else {
        // Inni użytkownicy widzą tylko swoje lokalizacje z user_locations
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('user_locations')
          .select('location_id, location:locations(id, name)')
          .eq('user_id', user.id);
        
        if (!error && data) {
          const locations = data.map((ul: any) => ({
            id: ul.location?.id || ul.location_id,
            name: ul.location?.name || 'Nieznana lokalizacja'
          }));
          setAvailableLocations(locations);
        }
      }
    };
    fetchLocations();
  }, []);

  const form = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      month: new Date().getMonth() + 1 + '',
      year: new Date().getFullYear() + '',
      periodType: 'month',
      quarter: '1',
      locationIds: [],
      showFromYearStart: false
    }
  });

  // Ustaw domyślną lokalizację po załadowaniu dostępnych lokalizacji
  React.useEffect(() => {
    if (availableLocations.length > 0 && form.getValues('locationIds').length === 0) {
      form.setValue('locationIds', [availableLocations[0].id]);
    }
  }, [availableLocations, form]);

  const [selectedMonth, selectedYear, periodType, quarter, locationIds, showFromYearStart] = form.watch([
    'month', 'year', 'periodType', 'quarter', 'locationIds', 'showFromYearStart'
  ]);
  
  const [financialSummary, setFinancialSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0,
    openingBalance: 0
  });

  const [yearToDateSummary, setYearToDateSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0,
    openingBalance: 0
  });

  // Oblicz podsumowanie finansowe na podstawie wybranych parametrów
  React.useEffect(() => {
    const calculatePreview = async () => {
      if (!selectedYear || !locationIds || locationIds.length === 0) return;
      if (periodType === 'month' && !selectedMonth) return;
      if (periodType === 'quarter' && !quarter) return;
      
      setIsCalculating(true);
      try {
        const year = parseInt(selectedYear);
        let dateFrom: string;
        let dateTo: string;
        let month: number;

        // Oblicz zakres dat w zależności od typu okresu
        if (periodType === 'year') {
          dateFrom = `${year}-01-01`;
          dateTo = `${year}-12-31`;
          month = 1; // Dla salda otwarcia
        } else if (periodType === 'quarter') {
          const q = parseInt(quarter || '1');
          const startMonth = (q - 1) * 3 + 1;
          const endMonth = q * 3;
          dateFrom = new Date(year, startMonth - 1, 1).toISOString().split('T')[0];
          dateTo = new Date(year, endMonth, 0).toISOString().split('T')[0];
          month = startMonth;
        } else {
          // month
          month = parseInt(selectedMonth!);
          const firstDayOfMonth = new Date(year, month - 1, 1);
          const lastDayOfMonth = new Date(year, month, 0);
          dateFrom = firstDayOfMonth.toISOString().split('T')[0];
          dateTo = lastDayOfMonth.toISOString().split('T')[0];
        }
        
        // Pobierz saldo otwarcia
        const openingBalance = await getOpeningBalance(locationIds, month, year);
        
        // Oblicz podsumowanie finansowe
        const summary = await calculateFinancialSummary(locationIds, dateFrom, dateTo);
        
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
  }, [selectedMonth, selectedYear, periodType, quarter, locationIds]);

  // Oblicz podsumowanie od początku roku
  React.useEffect(() => {
    if (!showFromYearStart) {
      setYearToDateSummary({ income: 0, expense: 0, balance: 0, openingBalance: 0 });
      return;
    }

    const calculateYearToDate = async () => {
      if (!selectedYear || !locationIds || locationIds.length === 0) return;
      if (periodType !== 'month' || !selectedMonth) return;
      
      setIsCalculatingYearToDate(true);
      try {
        const month = parseInt(selectedMonth);
        const year = parseInt(selectedYear);
        
        const openingBalance = await getOpeningBalance(locationIds, 1, year);
        
        const dateFrom = `${year}-01-01`;
        const lastDayOfMonth = new Date(year, month, 0);
        const dateTo = lastDayOfMonth.toISOString().split('T')[0];
        
        const summary = await calculateFinancialSummary(locationIds, dateFrom, dateTo);
        
        setYearToDateSummary({
          ...summary,
          openingBalance
        });
      } catch (error) {
        console.error("Błąd obliczania podglądu od początku roku:", error);
      }
      setIsCalculatingYearToDate(false);
    };

    calculateYearToDate();
  }, [showFromYearStart, selectedYear, selectedMonth, user?.location, form]);

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
            name="periodType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Typ okresu</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz typ okresu" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="month">Miesiąc</SelectItem>
                    <SelectItem value="quarter">Kwartał</SelectItem>
                    <SelectItem value="year">Rok</SelectItem>
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
                      <SelectValue placeholder="Wybierz rok" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {periodType === 'month' && (
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Miesiąc</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz miesiąc" />
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
          )}

          {periodType === 'quarter' && (
            <FormField
              control={form.control}
              name="quarter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kwartał</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz kwartał" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Q1 (Styczeń-Marzec)</SelectItem>
                      <SelectItem value="2">Q2 (Kwiecień-Czerwiec)</SelectItem>
                      <SelectItem value="3">Q3 (Lipiec-Wrzesień)</SelectItem>
                      <SelectItem value="4">Q4 (Październik-Grudzień)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="locationIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lokalizacje</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    // Obsługa pojedynczego wyboru - można rozszerzyć na multiple
                    field.onChange([value]);
                  }} 
                  defaultValue={field.value?.[0]}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz lokalizację" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Przychody</h4>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(financialSummary.income)}
                </p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Rozchody</h4>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(financialSummary.expense)}
                </p>
              </div>
              
              <div className="text-center">
                <h4 className="font-medium text-gray-600 mb-1">Saldo końcowe</h4>
                <p className={`text-xl font-bold ${financialSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialSummary.openingBalance + financialSummary.balance)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Szczegółowa rozpiska kont dla podsumowania */}
        {selectedYear && locationIds && locationIds.length > 0 && locationIds[0] && (
          <>
            {periodType === 'month' && selectedMonth && (
              <ReportAccountsBreakdown
                reportId=""
                locationId={locationIds[0]}
                month={parseInt(selectedMonth)}
                year={parseInt(selectedYear)}
              />
            )}
            {periodType === 'quarter' && quarter && (
              <ReportAccountsBreakdown
                reportId=""
                locationId={locationIds[0]}
                month={parseInt(quarter) * 3}
                year={parseInt(selectedYear)}
                dateRange={{
                  from: new Date(parseInt(selectedYear), (parseInt(quarter) - 1) * 3, 1).toISOString().split('T')[0],
                  to: new Date(parseInt(selectedYear), parseInt(quarter) * 3, 0).toISOString().split('T')[0]
                }}
              />
            )}
            {periodType === 'year' && (
              <ReportAccountsBreakdown
                reportId=""
                locationId={locationIds[0]}
                month={12}
                year={parseInt(selectedYear)}
                dateRange={{
                  from: `${selectedYear}-01-01`,
                  to: `${selectedYear}-12-31`
                }}
              />
            )}
          </>
        )}

        {/* Sekcja ze stanem kasowym i finansowym */}
        {selectedYear && locationIds && locationIds.length > 0 && locationIds[0] && periodType === 'month' && selectedMonth && (
          <YearToDateCashFlowBreakdown
            locationId={locationIds[0]}
            month={parseInt(selectedMonth)}
            year={parseInt(selectedYear)}
          />
        )}

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
                  Zaznacz, aby zobaczyć dane finansowe za cały rok (od stycznia do wybranego miesiąca)
                </p>
              </div>
            </FormItem>
          )}
        />
        
        {/* Podgląd podsumowania rok-do-daty */}
        {showFromYearStart && (
          <>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">
                Podsumowanie finansowe od początku {selectedYear} roku
                {selectedMonth && ` do ${months.find(m => m.value === selectedMonth)?.label}`}
              </h3>
              
              {isCalculatingYearToDate ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="sm" className="mr-2" />
                  <span>Obliczanie podsumowania od początku roku...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <h4 className="font-medium text-gray-600 mb-1">Otwarcie roku</h4>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(yearToDateSummary.openingBalance)}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <h4 className="font-medium text-gray-600 mb-1">Przychody</h4>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(yearToDateSummary.income)}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <h4 className="font-medium text-gray-600 mb-1">Rozchody</h4>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(yearToDateSummary.expense)}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <h4 className="font-medium text-gray-600 mb-1">Saldo końcowe</h4>
                    <p className={`text-xl font-bold ${yearToDateSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(yearToDateSummary.openingBalance + yearToDateSummary.balance)}
                    </p>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-blue-600 mt-3">
                * To podsumowanie pokazuje dane finansowe od 1 stycznia {selectedYear} do końca {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </p>
            </div>

            {/* Szczegółowa rozpiska kont dla podsumowania rok-do-daty */}
            {locationIds && locationIds.length > 0 && locationIds[0] && selectedMonth && (
              <YearToDateAccountsBreakdown
                locationId={locationIds[0]}
                month={parseInt(selectedMonth)}
                year={parseInt(selectedYear)}
              />
            )}

            {/* Stan kasowy i finansowy domu dla podsumowania rok-do-daty */}
            {selectedMonth && selectedYear && locationIds && locationIds.length > 0 && locationIds[0] && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                  Stan kasowy i finansowy domu od początku {selectedYear} roku
                  {selectedMonth && ` do końca ${months.find(m => m.value === selectedMonth)?.label}`}
                </h3>
                
                <YearToDateCashFlowBreakdown
                  locationId={locationIds[0]}
                  month={parseInt(selectedMonth)}
                  year={parseInt(selectedYear)}
                />
              </div>
            )}
          </>
        )}
      </form>
    </Form>
  );
};

export default ReportForm;
