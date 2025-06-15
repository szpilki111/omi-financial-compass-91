
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface ReportsListProps {
  onReportSelect: (reportId: string) => void;
  reportType?: 'monthly' | 'annual';
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

const ReportsList: React.FC<ReportsListProps> = ({ onReportSelect, reportType = 'monthly' }) => {
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['reports', reportType],
    queryFn: async () => {
      console.log('=== ROZPOCZĘCIE POBIERANIA RAPORTÓW ===');
      console.log('Typ raportu:', reportType);
      
      const { data: userRole } = await supabase.rpc('get_user_role');
      console.log('Rola użytkownika:', userRole);

      let query = supabase.from('reports').select(`
        *,
        location:locations(name),
        submitted_by_profile:profiles!submitted_by(name),
        reviewed_by_profile:profiles!reviewed_by(name)
      `);
      
      // Mapowanie typów raportów - raporty "standard" traktujemy jako miesięczne
      console.log('=== FILTROWANIE PO TYPIE RAPORTU ===');
      if (reportType === 'monthly') {
        // Dla raportów miesięcznych szukamy typu 'standard'
        console.log('Szukamy raportów miesięcznych (typu standard)');
        query = query.eq('report_type', 'standard');
      } else if (reportType === 'annual') {
        // Dla raportów rocznych szukamy typu 'annual'
        console.log('Szukamy raportów rocznych (typu annual)');
        query = query.eq('report_type', 'annual');
      }
      
      // Jeśli użytkownik to ekonom, filtruj po lokalizacji
      if (userRole === 'ekonom') {
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        console.log('ID lokalizacji użytkownika (ekonom):', locationId);
        
        if (locationId) {
          query = query.eq('location_id', locationId);
          console.log('Dodano filtr lokalizacji:', locationId);
        }
      }
      
      console.log('=== WYKONYWANIE ZAPYTANIA ===');
      const { data: reportsData, error: reportsError } = await query.order('created_at', { ascending: false });
      
      if (reportsError) {
        console.error('Błąd pobierania raportów:', reportsError);
        throw reportsError;
      }
      
      console.log('=== WYNIKI ZAPYTANIA ===');
      console.log('Liczba znalezionych raportów:', reportsData?.length || 0);
      console.log('Znalezione raporty:', reportsData);

      if (!reportsData || reportsData.length === 0) {
        console.log('=== BRAK RAPORTÓW ===');
        return [];
      }

      // Pobierz szczegóły raportów
      console.log('=== POBIERANIE SZCZEGÓŁÓW RAPORTÓW ===');
      const reportIds = reportsData.map(report => report.id);
      console.log('ID raportów do pobrania szczegółów:', reportIds);
      
      const { data: reportDetails, error: detailsError } = await supabase
        .from('report_details')
        .select('*')
        .in('report_id', reportIds);

      if (detailsError) {
        console.error('Błąd pobierania szczegółów raportów:', detailsError);
      } else {
        console.log('Pobrane szczegóły raportów:', reportDetails);
      }

      const detailsMap = new Map();
      if (reportDetails) {
        reportDetails.forEach(detail => {
          detailsMap.set(detail.report_id, detail);
        });
      }

      const transformedData = reportsData.map((report: any) => {
        const details = detailsMap.get(report.id);
        return {
          ...report,
          report_details: details || null
        };
      }) as Report[];
      
      console.log('=== KOŃCOWE DANE ===');
      console.log('Przekształcone dane raportów:', transformedData);
      console.log('Liczba końcowych raportów:', transformedData.length);
      
      return transformedData;
    }
  });

  if (isLoading) return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  
  if (error) return <div className="text-red-600 p-4">Błąd ładowania raportów: {(error as Error).message}</div>;

  const reportTypeText = reportType === 'monthly' ? 'miesięcznych' : 'rocznych';

  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-omi-gray-500 mb-4">Brak raportów {reportTypeText} do wyświetlenia.</p>
        <p className="text-sm text-gray-400">Sprawdź konsolę przeglądarki po szczegółowe logi debugowania.</p>
        <p className="text-xs text-gray-300 mt-2">Typ raportu: {reportType}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <Table>
        <TableCaption>Lista raportów {reportTypeText} z danymi finansowymi</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Placówka</TableHead>
            <TableHead>Okres</TableHead>
            <TableHead className="text-right">Saldo początkowe</TableHead>
            <TableHead className="text-right">Przychody</TableHead>
            <TableHead className="text-right">Rozchody</TableHead>
            <TableHead className="text-right">Saldo końcowe</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Złożony przez</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>{report.location?.name || 'Nieznana'}</TableCell>
              <TableCell>{report.period}</TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-blue-700">
                  {formatCurrency(report.report_details?.opening_balance)}
                </span>
              </TableCell>
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
                <span className={report.report_details?.closing_balance && report.report_details.closing_balance >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(report.report_details?.closing_balance)}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportsList;
