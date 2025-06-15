
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { calculateAndSaveReportSummary } from '@/utils/financeUtils';

interface ReportFormProps {
  reportId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Location {
  id: string;
  name: string;
}

const ReportForm: React.FC<ReportFormProps> = ({ reportId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [reportType, setReportType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pobierz role użytkownika i lokalizacje
  const { data: userRole } = useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_role');
      if (error) throw error;
      return data;
    }
  });

  // Pobierz dostępne lokalizacje
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      let query = supabase.from('locations').select('id, name').order('name');
      
      // Jeśli użytkownik to ekonom, pokaż tylko jego lokalizację
      if (userRole === 'ekonom') {
        const { data: userLocationId } = await supabase.rpc('get_user_location_id');
        if (userLocationId) {
          query = query.eq('id', userLocationId);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Location[];
    },
    enabled: !!userRole
  });

  // Ustaw domyślną lokalizację dla ekonoma
  useEffect(() => {
    if (userRole === 'ekonom' && locations && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [userRole, locations]);

  // Sprawdź czy raport już istnieje
  const checkReportExists = async (locationId: string, year: number, month?: number) => {
    let query = supabase
      .from('reports')
      .select('id')
      .eq('location_id', locationId)
      .eq('year', year)
      .eq('report_type', reportType);
      
    if (reportType === 'monthly' && month) {
      query = query.eq('month', month);
    }
    
    const { data } = await query;
    return data && data.length > 0;
  };

  const createReportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocationId) {
        throw new Error('Wybierz lokalizację');
      }

      // Sprawdź czy raport już istnieje
      const exists = await checkReportExists(
        selectedLocationId, 
        selectedYear, 
        reportType === 'monthly' ? selectedMonth : undefined
      );
      
      if (exists) {
        throw new Error(`Raport ${reportType === 'monthly' ? 'miesięczny' : 'roczny'} już istnieje dla tego okresu`);
      }

      const monthName = reportType === 'monthly' 
        ? new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pl-PL', { month: 'long' })
        : '';
      
      const period = reportType === 'monthly' 
        ? `${monthName} ${selectedYear}`
        : `${selectedYear}`;
      
      const title = reportType === 'monthly'
        ? `Raport miesięczny - ${period}`
        : `Raport roczny - ${period}`;

      // Utwórz raport
      const { data: newReport, error } = await supabase
        .from('reports')
        .insert({
          title,
          period,
          month: reportType === 'monthly' ? selectedMonth : null,
          year: selectedYear,
          status: 'draft',
          location_id: selectedLocationId,
          report_type: reportType
        })
        .select()
        .single();

      if (error) throw error;

      // Automatycznie oblicz i zapisz podsumowanie finansowe
      await calculateAndSaveReportSummary(
        newReport.id,
        selectedLocationId,
        reportType === 'monthly' ? selectedMonth : null,
        selectedYear
      );

      return newReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: "Sukces",
        description: `Raport ${reportType === 'monthly' ? 'miesięczny' : 'roczny'} został utworzony pomyślnie`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Wystąpił błąd podczas tworzenia raportu",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await createReportMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  if (locationsLoading) {
    return <div>Ładowanie...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tworzenie nowego raportu</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Typ raportu */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Typ raportu</label>
            <Select value={reportType} onValueChange={(value: 'monthly' | 'annual') => setReportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Miesięczny</SelectItem>
                <SelectItem value="annual">Roczny</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lokalizacja - tylko dla adminów */}
          {userRole === 'admin' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Lokalizacja</label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz lokalizację" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Rok */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rok</label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
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

          {/* Miesiąc - tylko dla raportów miesięcznych */}
          {reportType === 'monthly' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Miesiąc</label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
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
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Anuluj
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !selectedLocationId}
            >
              {isSubmitting ? 'Tworzenie...' : 'Utwórz raport'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReportForm;
