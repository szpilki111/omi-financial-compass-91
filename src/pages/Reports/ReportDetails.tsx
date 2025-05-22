
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate, useParams } from 'react-router-dom';
import { getReportFinancialDetails, calculateFinancialSummary } from '@/utils/financeUtils';
import { ArrowLeftIcon, FileTextIcon, FileIcon, RefreshCcwIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReportDetailsProps {
  reportId?: string;
}

const ReportDetails: React.FC<ReportDetailsProps> = ({ reportId: propReportId }) => {
  const { reportId: paramReportId } = useParams<{ reportId: string }>();
  const reportId = propReportId || paramReportId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pobieranie danych raportu
  const { data: report, isLoading: isLoadingReport, refetch: refetchReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) return null;

      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          location:locations(*),
          submitted_by_profile:profiles!submitted_by(*),
          reviewed_by_profile:profiles!reviewed_by(*)
        `)
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!reportId
  });

  // Pobieranie szczegółów finansowych raportu
  const { data: financialDetails, isLoading: isLoadingFinancial, refetch: refetchFinancial } = useQuery({
    queryKey: ['report_financial', reportId],
    queryFn: async () => {
      if (!reportId) return { income: 0, expense: 0, balance: 0, settlements: 0 };
      return await getReportFinancialDetails(reportId);
    },
    enabled: !!reportId
  });

  // Funkcja do odświeżania sum raportu
  const handleRefreshSums = async () => {
    if (!reportId) return;
    
    setIsRefreshing(true);
    
    try {
      // Pobierz dane raportu
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('month, year, location_id')
        .eq('id', reportId)
        .single();
        
      if (reportError) throw reportError;
      
      // Oblicz daty na podstawie miesiąca i roku
      const firstDayOfMonth = new Date(report.year, report.month - 1, 1);
      const lastDayOfMonth = new Date(report.year, report.month, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];
      
      // Oblicz finansowe podsumowanie
      const summary = await calculateFinancialSummary(report.location_id, dateFrom, dateTo);
      
      // Aktualizuj szczegóły raportu
      const { data: existingDetails } = await supabase
        .from('report_details')
        .select('id')
        .eq('report_id', reportId);
        
      if (existingDetails && existingDetails.length > 0) {
        // Aktualizuj istniejące szczegóły
        await supabase
          .from('report_details')
          .update({
            income_total: summary.income,
            expense_total: summary.expense,
            balance: summary.balance,
            updated_at: new Date().toISOString()
          })
          .eq('report_id', reportId);
      } else {
        // Utwórz nowe szczegóły
        await supabase
          .from('report_details')
          .insert({
            report_id: reportId,
            income_total: summary.income,
            expense_total: summary.expense,
            balance: summary.balance,
            settlements_total: 0
          });
      }
      
      // Odśwież dane
      await refetchFinancial();
      
      toast({
        title: "Sukces",
        description: "Sumy raportu zostały przeliczone poprawnie.",
      });
    } catch (error) {
      console.error('Błąd podczas odświeżania sum:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas przeliczania sum.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoadingReport || isLoadingFinancial) {
    return (
      <div className="flex justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Raport nie został znaleziony</h2>
        <Button onClick={() => navigate('/reports')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Powrót do listy raportów
        </Button>
      </div>
    );
  }

  // Formatowanie wartości walutowych
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  // Formatowanie statusu raportu
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Roboczy';
      case 'submitted':
        return 'Złożony';
      case 'approved':
        return 'Zatwierdzony';
      case 'rejected':
        return 'Odrzucony';
      default:
        return status;
    }
  };

  // Określenie klasy CSS dla statusu
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-yellow-600';
      case 'submitted':
        return 'text-blue-600';
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="text-omi-gray-500">
            Status: <span className={getStatusClass(report.status)}>{getStatusLabel(report.status)}</span>
          </p>
        </div>
        
        <div className="flex gap-2">
          {report.status === 'draft' && (
            <Button onClick={() => navigate(`/reports/edit/${reportId}`)}>
              Edytuj raport
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Placówka:</h2>
          <p>{report.location?.name || 'Nieznana placówka'}</p>
          
          <h2 className="text-lg font-semibold mt-4 mb-2">Okres:</h2>
          <p>{report.period}</p>
        </div>

        <div>
          {report.status !== 'draft' && (
            <>
              <h2 className="text-lg font-semibold mb-2">Data złożenia:</h2>
              <p>
                {report.submitted_at
                  ? new Date(report.submitted_at).toLocaleDateString('pl-PL')
                  : 'Nie złożono'}
              </p>
              
              <h2 className="text-lg font-semibold mt-4 mb-2">Złożony przez:</h2>
              <p>{report.submitted_by_profile?.name || 'Nieznany'}</p>
            </>
          )}
          
          {report.status === 'approved' || report.status === 'rejected' ? (
            <>
              <h2 className="text-lg font-semibold mt-4 mb-2">Data weryfikacji:</h2>
              <p>
                {report.reviewed_at
                  ? new Date(report.reviewed_at).toLocaleDateString('pl-PL')
                  : 'Nie zweryfikowano'}
              </p>
              
              <h2 className="text-lg font-semibold mt-4 mb-2">Zweryfikowany przez:</h2>
              <p>{report.reviewed_by_profile?.name || 'Nieznany'}</p>
            </>
          ) : null}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Podsumowanie finansowe</h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshSums} 
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <RefreshCcwIcon size={16} className="mr-2" />
            )}
            Przelicz sumy
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Przychody</h3>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(financialDetails?.income || 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Rozchody</h3>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(financialDetails?.expense || 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Bilans</h3>
                <p className={`text-2xl font-bold ${(financialDetails?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialDetails?.balance || 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Rozrachunki</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(financialDetails?.settlements || 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/reports')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Powrót do listy raportów
        </Button>
        
        <div className="space-x-2">
          <Button variant="outline" onClick={() => {}}>
            <FileTextIcon className="mr-2 h-4 w-4" />
            Eksportuj do PDF
          </Button>
          <Button variant="outline" onClick={() => {}}>
            <FileIcon className="mr-2 h-4 w-4" />
            Eksportuj do Excel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReportDetails;
