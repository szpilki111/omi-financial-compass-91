
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { ReportFormData } from '@/types/reports';

interface ReportFormProps {
  reportId?: string;
  reportType?: 'standard' | 'annual';
  onSuccess: () => void;
  onCancel: () => void;
}

const ReportForm = ({ reportId, reportType = 'standard', onSuccess, onCancel }: ReportFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState<ReportFormData>({
    month: reportType === 'annual' ? 12 : currentMonth,
    year: currentYear,
    report_type: reportType,
  });

  // Fetch existing report if editing
  const { data: existingReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) return null;
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });

  useEffect(() => {
    if (existingReport) {
      setFormData({
        month: existingReport.month,
        year: existingReport.year,
        report_type: existingReport.report_type as 'standard' | 'annual',
      });
    }
  }, [existingReport]);

  const createReportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      if (!user?.location_id) {
        throw new Error('Brak przypisanej lokalizacji');
      }

      const title = data.report_type === 'annual' 
        ? `Raport roczny ${data.year}`
        : `Raport ${data.month}/${data.year}`;
      
      const period = data.report_type === 'annual'
        ? `${data.year}`
        : `${data.month}/${data.year}`;

      const reportData = {
        title,
        period,
        month: data.month,
        year: data.year,
        status: 'draft',
        location_id: user.location_id,
        report_type: data.report_type,
      };

      if (reportId) {
        const { data: updatedReport, error } = await supabase
          .from('reports')
          .update(reportData)
          .eq('id', reportId)
          .select()
          .single();

        if (error) throw error;
        return updatedReport;
      } else {
        const { data: newReport, error } = await supabase
          .from('reports')
          .insert(reportData)
          .select()
          .single();

        if (error) throw error;
        return newReport;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (reportType === 'annual' && (formData.year < 2020 || formData.year > currentYear)) {
      toast({
        title: "Błąd",
        description: "Rok musi być w zakresie 2020-" + currentYear,
        variant: "destructive",
      });
      return;
    }

    if (reportType === 'standard' && (formData.month < 1 || formData.month > 12)) {
      toast({
        title: "Błąd",
        description: "Miesiąc musi być w zakresie 1-12",
        variant: "destructive",
      });
      return;
    }

    createReportMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof ReportFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const generateYearOptions = () => {
    const years = [];
    for (let year = 2020; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  };

  const generateMonthOptions = () => {
    const months = [];
    for (let month = 1; month <= 12; month++) {
      months.push({
        value: month,
        label: new Date(2000, month - 1).toLocaleDateString('pl-PL', { month: 'long' })
      });
    }
    return months;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {reportId ? 'Edytuj raport' : `Utwórz nowy raport ${reportType === 'annual' ? 'roczny' : 'miesięczny'}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="year">Rok</Label>
              <Select
                value={formData.year.toString()}
                onValueChange={(value) => handleInputChange('year', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz rok" />
                </SelectTrigger>
                <SelectContent>
                  {generateYearOptions().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reportType === 'standard' && (
              <div>
                <Label htmlFor="month">Miesiąc</Label>
                <Select
                  value={formData.month.toString()}
                  onValueChange={(value) => handleInputChange('month', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz miesiąc" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={createReportMutation.isPending}
            >
              {createReportMutation.isPending ? 'Zapisywanie...' : (reportId ? 'Aktualizuj' : 'Utwórz raport')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={createReportMutation.isPending}
            >
              Anuluj
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReportForm;
