import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { Report } from '@/types/reports';
import { formatCurrency } from '@/utils/financeUtils';
import { FileText, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface ReportsListProps {
  onReportSelect: (reportId: string) => void;
}

const ReportsList = ({ onReportSelect }: ReportsListProps) => {
  const { user } = useAuth();
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['reports', user?.location?.id, filterYear, filterStatus, filterType],
    queryFn: async () => {
      if (!user?.location?.id) return [];

      let query = supabase
        .from('reports')
        .select(`
          *,
          location:locations(name),
          submitted_by_profile:profiles!reports_submitted_by_fkey(name),
          reviewed_by_profile:profiles!reports_reviewed_by_fkey(name),
          report_details(*)
        `)
        .eq('location_id', user.location.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (filterYear !== 'all') {
        query = query.eq('year', parseInt(filterYear));
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterType !== 'all') {
        query = query.eq('report_type', filterType as 'standard' | 'annual');
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Report[];
    },
    enabled: !!user?.location?.id,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4" />;
      case 'submitted':
        return <FileText className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'to_be_corrected':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'to_be_corrected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Wersja robocza';
      case 'submitted':
        return 'Przesłany';
      case 'approved':
        return 'Zatwierdzony';
      case 'to_be_corrected':
        return 'Do poprawy';
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'standard':
        return 'Miesięczny';
      case 'annual':
        return 'Roczny';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'standard':
        return 'bg-blue-100 text-blue-800';
      case 'annual':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate year options from reports
  const availableYears = React.useMemo(() => {
    if (!reports) return [];
    const years = [...new Set(reports.map(report => report.year))].sort((a, b) => b - a);
    return years;
  }, [reports]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-red-500">Błąd podczas ładowania raportów</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtry */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rok</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie lata</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  <SelectItem value="draft">Wersja robocza</SelectItem>
                  <SelectItem value="submitted">Przesłany</SelectItem>
                  <SelectItem value="approved">Zatwierdzony</SelectItem>
                  <SelectItem value="to_be_corrected">Do poprawy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Typ raportu</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie typy</SelectItem>
                  <SelectItem value="standard">Miesięczny</SelectItem>
                  <SelectItem value="annual">Roczny</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista raportów */}
      {!reports || reports.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Brak raportów do wyświetlenia</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{report.title}</h3>
                      <Badge className={getStatusColor(report.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(report.status)}
                          {getStatusLabel(report.status)}
                        </div>
                      </Badge>
                      <Badge className={getTypeColor(report.report_type)}>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getTypeLabel(report.report_type)}
                        </div>
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">
                      Okres: {report.period}
                    </p>

                    {report.report_details && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-green-600">Przychody:</span>
                          <div>{formatCurrency(report.report_details.income_total)}</div>
                        </div>
                        <div>
                          <span className="font-medium text-red-600">Rozchody:</span>
                          <div>{formatCurrency(report.report_details.expense_total)}</div>
                        </div>
                        <div>
                          <span className="font-medium">Saldo:</span>
                          <div className={report.report_details.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(report.report_details.balance)}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Rozliczenia:</span>
                          <div>{formatCurrency(report.report_details.settlements_total)}</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                      {report.submitted_at && (
                        <div>Przesłany: {new Date(report.submitted_at).toLocaleDateString('pl-PL')}</div>
                      )}
                      {report.reviewed_at && (
                        <div>Zweryfikowany: {new Date(report.reviewed_at).toLocaleDateString('pl-PL')}</div>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={() => onReportSelect(report.id)}
                    className="ml-4"
                  >
                    Szczegóły
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsList;
