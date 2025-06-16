
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { calculateAndSaveReportSummary } from '@/utils/financeUtils';
import ReportAccountsBreakdown from '@/components/reports/ReportAccountsBreakdown';
import YearToDateSummary from '@/components/reports/YearToDateSummary';

const ReportForm: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState<number>();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showYearToDate, setShowYearToDate] = useState(false);

  // Pobieranie lokalizacji użytkownika
  const { data: userLocation, isLoading: isLoadingLocation } = useQuery({
    queryKey: ['user_location', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('location_id, locations(id, name)')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Sprawdzanie czy raport już istnieje
  const { data: existingReport } = useQuery({
    queryKey: ['existing_report', userLocation?.location_id, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!userLocation?.location_id || !selectedMonth || !selectedYear) return null;

      const { data, error } = await supabase
        .from('reports')
        .select('id, status')
        .eq('location_id', userLocation.location_id)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userLocation?.location_id && !!selectedMonth && !!selectedYear
  });

  // Mutacja do tworzenia raportu
  const createReportMutation = useMutation({
    mutationFn: async () => {
      if (!userLocation?.location_id || !selectedMonth || !selectedYear) {
        throw new Error('Brak wymaganych danych');
      }

      const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
      ];

      const title = `Raport ${monthNames[selectedMonth - 1]} ${selectedYear}`;
      const period = `${selectedMonth.toString().padStart(2, '0')}.${selectedYear}`;

      // Utwórz raport
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          title,
          period,
          month: selectedMonth,
          year: selectedYear,
          status: 'draft',
          location_id: userLocation.location_id,
          report_type: 'standard'
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Oblicz i zapisz automatycznie podsumowanie finansowe
      await calculateAndSaveReportSummary(
        report.id,
        userLocation.location_id,
        selectedMonth,
        selectedYear
      );

      return report;
    },
    onSuccess: (report) => {
      toast({
        title: "Raport utworzony",
        description: `Raport ${report.title} został utworzony pomyślnie.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate(`/reports/${report.id}`);
    },
    onError: (error) => {
      console.error('Błąd podczas tworzenia raportu:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas tworzenia raportu.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    setIsSubmitting(true);
    createReportMutation.mutate();
  };

  // Generowanie opcji miesięcy
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
    { value: 12, label: 'Grudzień' }
  ];

  // Generowanie opcji lat (obecny rok i kilka poprzednich)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (isLoadingLocation) {
    return (
      <div className="flex justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!userLocation?.locations?.name) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Brak uprawnień</h2>
        <p>Nie masz przypisanej lokalizacji. Skontaktuj się z administratorem.</p>
      </div>
    );
  }

  const canCreateReport = selectedMonth && selectedYear && !existingReport;
  const reportExists = existingReport && existingReport.status;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nowy raport</h1>
        <p className="text-omi-gray-500 mt-2">
          Lokalizacja: {userLocation.locations.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Szczegóły raportu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Miesiąc</label>
              <Select
                value={selectedMonth?.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz miesiąc" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Rok</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz rok" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkbox do pokazywania podsumowania od początku roku */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-year-to-date"
              checked={showYearToDate}
              onCheckedChange={(checked) => setShowYearToDate(checked === true)}
            />
            <label
              htmlFor="show-year-to-date"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Pokaż podsumowanie od początku roku
            </label>
          </div>

          {reportExists && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <p className="text-orange-800">
                Raport za wybrany okres już istnieje. Status: <strong>{reportExists}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!canCreateReport || isSubmitting}
            >
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Utwórz raport
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/reports')}
            >
              Anuluj
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Szczegółowa rozpiska kont dla wybranego miesiąca */}
      {selectedMonth && selectedYear && userLocation?.location_id && (
        <ReportAccountsBreakdown
          reportId=""
          locationId={userLocation.location_id}
          month={selectedMonth}
          year={selectedYear}
        />
      )}

      {/* Podsumowanie od początku roku */}
      {selectedMonth && selectedYear && userLocation?.location_id && (
        <YearToDateSummary
          locationId={userLocation.location_id}
          currentMonth={selectedMonth}
          currentYear={selectedYear}
          isVisible={showYearToDate}
        />
      )}
    </div>
  );
};

export default ReportForm;
