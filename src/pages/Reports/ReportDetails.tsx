
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate, useParams } from 'react-router-dom';
import { getReportFinancialDetails, calculateFinancialSummary, updateReportDetails } from '@/utils/financeUtils';
import { ArrowLeftIcon, FileTextIcon, FileIcon, RefreshCcwIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import KpirSummary from '../KPIR/components/KpirSummary';
import ReportApprovalActions from '@/components/reports/ReportApprovalActions';

interface ReportDetailsProps {
  reportId?: string;
}

const ReportDetails: React.FC<ReportDetailsProps> = ({ reportId: propReportId }) => {
  const { reportId: paramReportId } = useParams<{ reportId: string }>();
  const reportId = propReportId || paramReportId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, canApproveReports } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Sprawdź, czy użytkownik może ponownie złożyć raport do poprawy
  const canResubmit = user?.role === 'ekonom' && report?.status === 'to_be_corrected';

  // Sprawdź, czy raport jest zablokowany (złożony lub zatwierdzony)
  const isReportLocked = report?.status === 'submitted' || report?.status === 'approved';

  // Sprawdź, czy sumy zostały już przeliczone (czy są inne niż wszystkie zerowe)
  const hasCalculatedSums = financialDetails && (
    financialDetails.income !== 0 || 
    financialDetails.expense !== 0 || 
    financialDetails.balance !== 0
  );

  // Funkcja do odświeżania sum raportu
  const handleRefreshSums = async () => {
    if (!reportId || isReportLocked) {
      if (isReportLocked) {
        toast({
          title: "Działanie zablokowane",
          description: "Nie można przeliczać sum dla złożonych lub zatwierdzonych raportów.",
          variant: "destructive",
        });
      }
      return;
    }
    
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
      
      // Aktualizuj szczegóły raportu w bazie danych
      await updateReportDetails(reportId, summary);
      
      // Odśwież dane bez reload strony
      await refetchFinancial();
      
      toast({
        title: "Sukces",
        description: "Sumy raportu zostały przeliczone i zapisane.",
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
  
  // Funkcja do składania raportu
  const handleSubmitReport = async () => {
    if (!reportId) return;
    
    setIsSubmitting(true);
    
    try {
      // Zaktualizuj status raportu
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: (await supabase.auth.getUser()).data.user?.id,
          // Wyczyść poprzednie komentarze przy ponownym złożeniu
          comments: null,
          reviewed_at: null,
          reviewed_by: null
        })
        .eq('id', reportId);
        
      if (error) throw error;
      
      // Odśwież dane raportu bez reload strony
      await refetchReport();
      
      toast({
        title: "Raport złożony",
        description: "Raport został złożony do sprawdzenia.",
      });
    } catch (error) {
      console.error('Błąd podczas składania raportu:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas składania raportu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovalComplete = async () => {
    // Odśwież dane raportu bez reload całej strony
    await refetchReport();
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
      case 'to_be_corrected':
        return 'Do poprawy';
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
      case 'to_be_corrected':
        return 'text-orange-600';
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
          {(report.status === 'draft' || canResubmit) && user?.role === 'ekonom' && (
            <Button onClick={handleSubmitReport} disabled={isSubmitting}>
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              {report.status === 'to_be_corrected' ? 'Popraw i złóż ponownie' : 'Złóż raport'}
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
          
          {(report.status === 'approved' || report.status === 'to_be_corrected') && (
            <>
              <h2 className="text-lg font-semibold mt-4 mb-2">Data weryfikacji:</h2>
              <p>
                {report.reviewed_at
                  ? new Date(report.reviewed_at).toLocaleDateString('pl-PL')
                  : 'Nie zweryfikowano'}
              </p>
              
              <h2 className="text-lg font-semibold mt-4 mb-2">Zweryfikowany przez:</h2>
              <p>{report.reviewed_by_profile?.name || 'Nieznany'}</p>

              {report.comments && (
                <>
                  <h2 className="text-lg font-semibold mt-4 mb-2">Komentarze:</h2>
                  <p className="text-sm bg-gray-100 p-3 rounded">{report.comments}</p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sekcja zatwierdzania dla admina i prowincjała - używamy canApproveReports z kontekstu */}
      {canApproveReports && report?.status === 'submitted' && (
        <ReportApprovalActions 
          reportId={reportId!} 
          onApprovalComplete={handleApprovalComplete}
        />
      )}
      
      {/* Wyświetlenie komentarzy dla raportów do poprawy */}
      {report.status === 'to_be_corrected' && report.comments && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">Komentarze do poprawek</h3>
          <p className="text-orange-700">{report.comments}</p>
          {report.reviewed_by_profile && (
            <p className="text-sm text-orange-600 mt-2">
              Autor komentarza: {report.reviewed_by_profile.name}
            </p>
          )}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Podsumowanie finansowe</h2>
          {!isReportLocked && (
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
          )}
          {isReportLocked && (
            <p className="text-sm text-omi-gray-500 italic">
              Sumy są zablokowane dla {report.status === 'submitted' ? 'złożonych' : 'zatwierdzonych'} raportów
            </p>
          )}
        </div>

        {financialDetails && (
          <>
            {!hasCalculatedSums && !isReportLocked ? (
              <div className="text-center py-8">
                <p className="text-omi-gray-500 mb-4">
                  Sumy nie zostały jeszcze przeliczone dla tego raportu.
                </p>
                <Button onClick={handleRefreshSums} disabled={isRefreshing}>
                  {isRefreshing ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <RefreshCcwIcon size={16} className="mr-2" />
                  )}
                  Przelicz sumy teraz
                </Button>
              </div>
            ) : (
              <KpirSummary 
                income={financialDetails.income}
                expense={financialDetails.expense}
                balance={financialDetails.balance}
              />
            )}
          </>
        )}
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
