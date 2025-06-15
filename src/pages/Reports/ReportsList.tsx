
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/Spinner';
import { Search, X } from 'lucide-react';

interface ReportsListProps {
  onReportSelect: (reportId: string) => void;
}

const getStatusBadgeProps = (status: Report['status']) => {
  switch (status) {
    case 'submitted':
      return { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'approved':
      return { variant: 'outline' as const, className: 'bg-green-100 text-green-800 border-green-200' };
    case 'to_be_corrected':
      return { variant: 'outline' as const, className: 'bg-orange-100 text-orange-800 border-orange-200' };
    default:
      return { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

const getStatusLabel = (status: Report['status']) => {
  switch (status) {
    case 'draft': return 'Roboczy';
    case 'submitted': return 'Złożony';
    case 'approved': return 'Zaakceptowany';
    case 'to_be_corrected': return 'Do poprawy';
    default: return status;
  }
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return 'Brak danych';
  }
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const monthNames = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];

const ReportsList: React.FC<ReportsListProps> = ({ onReportSelect }) => {
  const [searchMonth, setSearchMonth] = useState<string>('');
  const [searchYear, setSearchYear] = useState<string>('');

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data: userRole } = await supabase.rpc('get_user_role');
      console.log('Rola użytkownika:', userRole);
      
      let query = supabase.from('reports').select(`
        *,
        location:locations(name),
        submitted_by_profile:profiles!submitted_by(name),
        reviewed_by_profile:profiles!reviewed_by(name)
      `);
      
      if (userRole === 'ekonom') {
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        console.log('ID lokalizacji użytkownika:', locationId);
        
        if (locationId) {
          query = query.eq('location_id', locationId);
        }
      }
      
      const { data: reportsData, error: reportsError } = await query.order('created_at', { ascending: false });
      
      if (reportsError) throw reportsError;
      console.log('Pobrane raporty:', reportsData);

      // Jeśli nie ma raportów, zwróć pustą tablicę
      if (!reportsData || reportsData.length === 0) {
        return [];
      }

      // Pobierz szczegóły finansowe dla wszystkich raportów w osobnym zapytaniu
      const reportIds = reportsData.map(report => report.id);
      const { data: reportDetails, error: detailsError } = await supabase
        .from('report_details')
        .select('*')
        .in('report_id', reportIds);

      if (detailsError) {
        console.error('Błąd pobierania szczegółów raportów:', detailsError);
      }

      console.log('Pobrane szczegóły raportów:', reportDetails);

      // Stwórz mapę szczegółów według report_id
      const detailsMap = new Map();
      if (reportDetails) {
        reportDetails.forEach(detail => {
          detailsMap.set(detail.report_id, detail);
        });
      }

      // Połącz raporty ze szczegółami
      const transformedData = reportsData.map((report: any) => {
        const details = detailsMap.get(report.id);
        return {
          ...report,
          report_details: details || null
        };
      }) as Report[];
      
      console.log('Przekształcone dane raportów:', transformedData);
      return transformedData;
    }
  });

  // Sortowanie chronologiczne i filtrowanie raportów
  const filteredAndSortedReports = useMemo(() => {
    if (!reports) return [];
    
    let filtered = reports;
    
    // Filtrowanie po miesiącu
    if (searchMonth) {
      const monthNumber = parseInt(searchMonth);
      filtered = filtered.filter(report => report.month === monthNumber);
    }
    
    // Filtrowanie po roku
    if (searchYear) {
      const yearNumber = parseInt(searchYear);
      filtered = filtered.filter(report => report.year === yearNumber);
    }
    
    // Sortowanie chronologiczne (najnowsze najpierw)
    return filtered.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year; // Rok malejąco
      }
      return b.month - a.month; // Miesiąc malejąco w tym samym roku
    });
  }, [reports, searchMonth, searchYear]);

  // Unikalne lata z raportów do selektora
  const availableYears = useMemo(() => {
    if (!reports) return [];
    const years = [...new Set(reports.map(report => report.year))];
    return years.sort((a, b) => b - a); // Najnowsze lata najpierw
  }, [reports]);

  const clearFilters = () => {
    setSearchMonth('');
    setSearchYear('');
  };

  if (isLoading) return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  
  if (error) return <div className="text-red-600 p-4">Błąd ładowania raportów: {(error as Error).message}</div>;
  
  if (!reports?.length) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-sm text-center">
        <p className="text-omi-gray-500 mb-4">Brak raportów do wyświetlenia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtry wyszukiwania */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtruj:</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label htmlFor="month-filter" className="text-sm text-gray-600">Miesiąc:</label>
            <Select value={searchMonth} onValueChange={setSearchMonth}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Wszystkie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Wszystkie</SelectItem>
                {monthNames.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <label htmlFor="year-filter" className="text-sm text-gray-600">Rok:</label>
            <Select value={searchYear} onValueChange={setSearchYear}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Wszystkie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Wszystkie</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {(searchMonth || searchYear) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center gap-1">
              <X className="h-3 w-3" />
              Wyczyść
            </Button>
          )}
        </div>
        
        {filteredAndSortedReports.length !== reports.length && (
          <div className="mt-2 text-sm text-gray-600">
            Znaleziono {filteredAndSortedReports.length} z {reports.length} raportów
          </div>
        )}
      </div>

      {/* Tabela raportów */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableCaption>Lista raportów z danymi finansowymi (sortowane chronologicznie)</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Placówka</TableHead>
              <TableHead>Okres</TableHead>
              <TableHead className="text-right">Przychody</TableHead>
              <TableHead className="text-right">Rozchody</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Złożony przez</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Brak raportów spełniających kryteria wyszukiwania
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{report.location?.name || 'Nieznana'}</TableCell>
                  <TableCell>{report.period}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="text-green-700">
                      {formatCurrency(report.report_details?.income_total)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="text-red-700">
                      {formatCurrency(report.report_details?.expense_total)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    <span className={report.report_details?.balance && report.report_details.balance >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {formatCurrency(report.report_details?.balance)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge {...getStatusBadgeProps(report.status)}>
                      {getStatusLabel(report.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.submitted_by_profile?.name || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" onClick={() => onReportSelect(report.id)}>
                      Szczegóły
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ReportsList;
