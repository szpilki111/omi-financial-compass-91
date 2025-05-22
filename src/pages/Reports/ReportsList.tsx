
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
}

const getStatusBadgeProps = (status: Report['status']) => {
  switch (status) {
    case 'submitted':
      return { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'accepted':
      return { variant: 'outline' as const, className: 'bg-green-100 text-green-800 border-green-200' };
    case 'rejected':
      return { variant: 'outline' as const, className: 'bg-red-100 text-red-800 border-red-200' };
    default:
      return { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

const getStatusLabel = (status: Report['status']) => {
  switch (status) {
    case 'draft': return 'Roboczy';
    case 'submitted': return 'Złożony';
    case 'accepted': return 'Zaakceptowany';
    case 'rejected': return 'Odrzucony';
    default: return status;
  }
};

const getReportTypeLabel = (type: string) => {
  switch (type) {
    case 'standard': return 'Standardowy';
    case 'zos': return 'ZOS';
    case 'bilans': return 'Bilans';
    case 'rzis': return 'RZiS';
    case 'jpk': return 'JPK';
    case 'analiza': return 'Analiza';
    default: return type;
  }
};

const ReportsList: React.FC<ReportsListProps> = ({ onReportSelect }) => {
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      // Sprawdzenie roli użytkownika
      const { data: userRole } = await supabase.rpc('get_user_role');
      console.log('Rola użytkownika:', userRole);
      
      let query = supabase.from('reports').select('*');
      
      // Jeśli użytkownik jest ekonomem, pobierz tylko raporty jego placówki
      if (userRole === 'ekonom') {
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        console.log('ID lokalizacji użytkownika:', locationId);
        
        if (locationId) {
          query = query.eq('location_id', locationId);
        }
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log('Pobrane raporty:', data);
      return data as Report[];
    }
  });

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
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <Table>
        <TableCaption>Lista raportów</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Tytuł</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Okres</TableHead>
            <TableHead>Data utworzenia</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>{report.title}</TableCell>
              <TableCell>
                <Badge variant="secondary">{getReportTypeLabel(report.report_type || 'standard')}</Badge>
              </TableCell>
              <TableCell>{report.period}</TableCell>
              <TableCell>
                {report.created_at ? format(new Date(report.created_at), 'PPP', { locale: pl }) : '-'}
              </TableCell>
              <TableCell>
                <Badge {...getStatusBadgeProps(report.status)}>
                  {getStatusLabel(report.status)}
                </Badge>
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
