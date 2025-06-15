
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const ReportTable: React.FC<{ 
  reports: Report[]; 
  onReportSelect: (reportId: string) => void; 
  caption: string; 
}> = ({ reports, onReportSelect, caption }) => (
  <Table>
    <TableCaption>{caption}</TableCaption>
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
);

const ReportsList: React.FC<ReportsListProps> = ({ onReportSelect }) => {
  const [activeTab, setActiveTab] = useState('monthly');

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

  if (isLoading) return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  
  if (error) return <div className="text-red-600 p-4">Błąd ładowania raportów: {(error as Error).message}</div>;
  
  // Podziel raporty na miesięczne i roczne
  const monthlyReports = reports?.filter(report => report.report_type === 'monthly') || [];
  const annualReports = reports?.filter(report => report.report_type === 'annual') || [];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monthly">Raporty miesięczne ({monthlyReports.length})</TabsTrigger>
          <TabsTrigger value="annual">Raporty roczne ({annualReports.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="monthly">
          {monthlyReports.length > 0 ? (
            <ReportTable 
              reports={monthlyReports} 
              onReportSelect={onReportSelect} 
              caption="Lista raportów miesięcznych z danymi finansowymi" 
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-omi-gray-500 mb-4">Brak raportów miesięcznych do wyświetlenia.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="annual">
          {annualReports.length > 0 ? (
            <ReportTable 
              reports={annualReports} 
              onReportSelect={onReportSelect} 
              caption="Lista raportów rocznych z danymi finansowymi" 
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-omi-gray-500 mb-4">Brak raportów rocznych do wyświetlenia.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsList;
