
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { calculateAndSaveReportSummary } from '@/utils/financeUtils';
import { Calendar, FileText, Loader2 } from 'lucide-react';

interface ReportFormProps {
  reportId?: string;
  reportType?: 'monthly' | 'annual';
  onSuccess: () => void;
  onCancel: () => void;
}

const ReportForm: React.FC<ReportFormProps> = ({ 
  reportId, 
  reportType = 'monthly',
  onSuccess, 
  onCancel 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_id: user?.location || '',
    year: new Date().getFullYear(),
    month: reportType === 'monthly' ? new Date().getMonth() + 1 : null,
    report_type: reportType,
    status: 'draft' as const
  });

  useEffect(() => {
    fetchLocations();
    if (reportId) {
      fetchReportDetails();
    }
  }, [reportId]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchReportDetails = async () => {
    if (!reportId) return;

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          title: data.title,
          description: data.description || '',
          location_id: data.location_id,
          year: data.year,
          month: data.month,
          report_type: data.report_type as 'monthly' | 'annual',
          status: data.status as 'draft'
        });
      }
    } catch (error) {
      console.error('Error fetching report details:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać szczegółów raportu",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Walidacja
      if (!formData.title.trim()) {
        throw new Error('Tytuł raportu jest wymagany');
      }

      if (!formData.location_id) {
        throw new Error('Lokalizacja jest wymagana');
      }

      if (formData.report_type === 'monthly' && !formData.month) {
        throw new Error('Miesiąc jest wymagany dla raportu miesięcznego');
      }

      // Sprawdź czy raport już istnieje dla tego okresu
      let duplicateQuery = supabase
        .from('reports')
        .select('id')
        .eq('location_id', formData.location_id)
        .eq('year', formData.year)
        .eq('report_type', formData.report_type);

      if (formData.report_type === 'monthly' && formData.month) {
        duplicateQuery = duplicateQuery.eq('month', formData.month);
      }

      if (reportId) {
        duplicateQuery = duplicateQuery.neq('id', reportId);
      }

      const { data: existingReports, error: duplicateError } = await duplicateQuery;

      if (duplicateError) throw duplicateError;

      if (existingReports && existingReports.length > 0) {
        const periodText = formData.report_type === 'monthly' 
          ? `${formData.month}/${formData.year}`
          : `${formData.year}`;
        throw new Error(`Raport ${formData.report_type === 'monthly' ? 'miesięczny' : 'roczny'} dla okresu ${periodText} już istnieje`);
      }

      if (reportId) {
        // Aktualizacja istniejącego raportu
        const { error: updateError } = await supabase
          .from('reports')
          .update({
            title: formData.title,
            description: formData.description,
            location_id: formData.location_id,
            year: formData.year,
            month: formData.report_type === 'monthly' ? formData.month : null,
            report_type: formData.report_type,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);

        if (updateError) throw updateError;

        // Przelicz podsumowanie finansowe
        await calculateAndSaveReportSummary(
          reportId,
          formData.location_id,
          formData.report_type === 'monthly' ? formData.month : null,
          formData.year
        );

      } else {
        // Tworzenie nowego raportu
        const { data: newReport, error: insertError } = await supabase
          .from('reports')
          .insert({
            title: formData.title,
            description: formData.description,
            location_id: formData.location_id,
            year: formData.year,
            month: formData.report_type === 'monthly' ? formData.month : null,
            report_type: formData.report_type,
            status: formData.status,
            created_by: user?.id
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Automatycznie oblicz i zapisz podsumowanie finansowe
        if (newReport) {
          await calculateAndSaveReportSummary(
            newReport.id,
            formData.location_id,
            formData.report_type === 'monthly' ? formData.month : null,
            formData.year
          );
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving report:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać raportu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {formData.report_type === 'annual' ? (
            <Calendar className="h-5 w-5" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
          {reportId ? 'Edytuj raport' : `Utwórz raport ${formData.report_type === 'annual' ? 'roczny' : 'miesięczny'}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Tytuł raportu *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder={`Raport ${formData.report_type === 'annual' ? 'roczny' : 'miesięczny'} ${formData.year}${formData.report_type === 'monthly' && formData.month ? `/${formData.month.toString().padStart(2, '0')}` : ''}`}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokalizacja *</Label>
              <Select
                value={formData.location_id}
                onValueChange={(value) => handleInputChange('location_id', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz lokalizację" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Rok *</Label>
              <Select
                value={formData.year.toString()}
                onValueChange={(value) => handleInputChange('year', parseInt(value))}
                required
              >
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

            {formData.report_type === 'monthly' && (
              <div className="space-y-2">
                <Label htmlFor="month">Miesiąc *</Label>
                <Select
                  value={formData.month?.toString() || ''}
                  onValueChange={(value) => handleInputChange('month', parseInt(value))}
                  required
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
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Dodatkowy opis raportu..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reportId ? 'Zaktualizuj' : 'Utwórz'} raport
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReportForm;
