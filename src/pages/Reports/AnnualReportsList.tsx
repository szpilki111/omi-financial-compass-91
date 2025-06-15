
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import AnnualReportForm from './AnnualReportForm';
import { useNavigate } from 'react-router-dom';

interface AnnualReport {
  id: string;
  title: string;
  period: string;
  year: number;
  status: string;
  created_at: string;
  updated_at: string;
  location_id: string;
  locations?: {
    name: string;
  };
  submitted_by_profile?: {
    name: string;
  };
}

const AnnualReportsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['annual-reports', searchTerm, selectedYear, selectedStatus],
    queryFn: async () => {
      console.log('Pobieranie raportów rocznych...');
      
      let query = supabase
        .from('reports')
        .select(`
          *,
          locations(name),
          submitted_by_profile:profiles!reports_submitted_by_fkey(name)
        `)
        .eq('report_type', 'annual')
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,period.ilike.%${searchTerm}%`);
      }

      if (selectedYear && selectedYear !== 'all') {
        query = query.eq('year', parseInt(selectedYear));
      }

      if (selectedStatus && selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Błąd pobierania raportów rocznych:', error);
        throw error;
      }
      
      console.log('Pobrane raporty roczne:', data);
      return data as AnnualReport[];
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'submitted':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Szkic';
      case 'submitted':
        return 'Wysłany';
      case 'approved':
        return 'Zatwierdzony';
      case 'rejected':
        return 'Odrzucony';
      default:
        return 'Nieznany';
    }
  };

  const handleReportClick = (report: AnnualReport) => {
    navigate(`/raporty/${report.id}`);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    refetch();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  if (isFormOpen) {
    return (
      <AnnualReportForm
        onSuccess={handleFormSuccess}
        onCancel={() => setIsFormOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Raporty roczne</h2>
          <p className="text-gray-600">Zarządzaj raportami rocznymi</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nowy raport roczny
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Szukaj po tytule lub okresie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Rok" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie lata</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="draft">Szkic</SelectItem>
                <SelectItem value="submitted">Wysłany</SelectItem>
                <SelectItem value="approved">Zatwierdzony</SelectItem>
                <SelectItem value="rejected">Odrzucony</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reports && reports.length > 0 ? (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card 
              key={report.id} 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleReportClick(report)}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {report.title}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(report.status)}>
                        {getStatusText(report.status)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Rok: {report.year}</span>
                      </div>
                      
                      <div>
                        <span>Lokalizacja: {report.locations?.name || 'Nieznana'}</span>
                      </div>
                      
                      <div>
                        <span>
                          Utworzony: {format(new Date(report.created_at), 'dd.MM.yyyy', { locale: pl })}
                        </span>
                      </div>
                    </div>

                    {report.submitted_by_profile && (
                      <div className="mt-2 text-sm text-gray-500">
                        Autor: {report.submitted_by_profile.name}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Brak raportów rocznych
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || (selectedYear !== 'all') || (selectedStatus !== 'all')
                ? 'Nie znaleziono raportów spełniających kryteria wyszukiwania.'
                : 'Rozpocznij pracę tworząc pierwszy raport roczny.'}
            </p>
            {!searchTerm && selectedYear === 'all' && selectedStatus === 'all' && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Utwórz pierwszy raport
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnnualReportsList;
