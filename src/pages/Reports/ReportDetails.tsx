 import React, { useState } from 'react';
 import { getFirstDayOfMonth, getLastDayOfMonth } from '@/utils/dateUtils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate, useParams } from 'react-router-dom';
import { getReportFinancialDetails, calculateFinancialSummary, updateReportDetails, getOpeningBalance } from '@/utils/financeUtils';
import { ArrowLeftIcon, FileTextIcon, FileIcon, RefreshCcwIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import KpirSummary from '../KPIR/components/KpirSummary';
import ReportApprovalActions from '@/components/reports/ReportApprovalActions';
import ReportAccountsBreakdown from '@/components/reports/ReportAccountsBreakdown';
import ReportPDFGenerator from '@/components/reports/ReportPDFGenerator';
import YearToDateCashFlowBreakdown from '@/components/reports/YearToDateCashFlowBreakdown';
 import ExportToExcelFull from '@/components/reports/ExportToExcelFull';
import ReportViewFull from '@/components/reports/ReportViewFull';
import { Report } from '@/types/reports';

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Pobieranie danych raportu
  const { data: report, isLoading: isLoadingReport, refetch: refetchReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!reportId) return null;

      console.log('🔍 Pobieranie danych raportu:', reportId);

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

      if (error) {
        console.error('❌ Błąd pobierania raportu:', error);
        throw error;
      }
      
      console.log('✅ Dane raportu pobrane:', data);
      // Cast the data to the proper Report type to ensure status is properly typed
      return data as Report;
    },
    enabled: !!reportId
  });

  // Pobieranie szczegółów finansowych raportu
  const { data: financialDetails, isLoading: isLoadingFinancial, refetch: refetchFinancial } = useQuery({
    queryKey: ['report_financial', reportId],
    queryFn: async () => {
      if (!reportId || !report) return { income: 0, expense: 0, balance: 0, settlements: 0, openingBalance: 0 };
      
      console.log('💰 Pobieranie szczegółów finansowych dla raportu:', reportId);
      
      // Najpierw spróbuj pobrać zapisane szczegóły
      let result = await getReportFinancialDetails(reportId);
      
      // Jeśli to raport w statusie "draft", "submitted" lub "approved", zawsze oblicz i wyświetl sumy automatycznie
      if (report?.status === 'draft' || report?.status === 'submitted' || report?.status === 'approved') {
        console.log('🔄 Raport - obliczam sumy automatycznie dla statusu:', report.status);
        
        try {
          // Pobierz dane raportu
          const { data: reportData, error: reportError } = await supabase
            .from('reports')
            .select('month, year, location_id')
            .eq('id', reportId)
            .single();
            
          if (reportError) throw reportError;
          
          // Oblicz daty na podstawie miesiąca i roku
          const firstDayOfMonth = new Date(reportData.year, reportData.month - 1, 1);
          const lastDayOfMonth = new Date(reportData.year, reportData.month, 0);
          
          const dateFrom = getFirstDayOfMonth(reportData.year, reportData.month);
          const dateTo = getLastDayOfMonth(reportData.year, reportData.month);
          
          // Pobierz saldo otwarcia
          const openingBalance = await getOpeningBalance(reportData.location_id, reportData.month, reportData.year);
          
          // Oblicz finansowe podsumowanie
          const summary = await calculateFinancialSummary(reportData.location_id, dateFrom, dateTo);
          
          // Aktualizuj szczegóły w bazie danych tylko jeśli nie są już zapisane lub to raport roboczy
          if ((result.income === 0 && result.expense === 0 && result.openingBalance === 0) || report?.status === 'draft') {
            await updateReportDetails(reportId, { ...summary, openingBalance });
          }
          
          result = { ...summary, openingBalance, settlements: 0 };
          console.log('✅ Automatycznie obliczone szczegóły dla raportu:', result);
        } catch (error) {
          console.error('❌ Błąd automatycznego obliczania:', error);
        }
      }
      
      console.log('✅ Szczegóły finansowe pobrane:', result);
      return result;
    },
    enabled: !!reportId && !!report
  });

  // Sprawdź, czy użytkownik może ponownie złożyć raport do poprawy (ekonom LUB proboszcz)
  const canResubmit = (user?.role === 'ekonom' || user?.role === 'proboszcz') && report?.status === 'to_be_corrected';

  // Sprawdź, czy raport jest zablokowany (złożony lub zatwierdzony)
  const isReportLocked = report?.status === 'submitted' || report?.status === 'approved';

  // Sprawdź, czy sumy zostały już przeliczone (czy są inne niż wszystkie zerowe)
  const hasCalculatedSums = financialDetails && (
    financialDetails.income !== 0 || 
    financialDetails.expense !== 0 || 
    financialDetails.balance !== 0 ||
    financialDetails.openingBalance !== 0
  );

  // Określ, czy pokazać przycisk "Przelicz sumy" - ZAWSZE dla draft/to_be_corrected
  const shouldShowRecalculateButton = report?.status === 'draft' || report?.status === 'to_be_corrected';

  // Funkcja do odświeżania sum raportu - tylko dla raportów roboczych i do poprawy
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
      console.log('🔄 Rozpoczynam przeliczanie sum dla raportu:', reportId);
      
      // Pobierz dane raportu
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('month, year, location_id')
        .eq('id', reportId)
        .single();
        
      if (reportError) throw reportError;
      
      console.log('📋 Dane raportu:', report);
      
      // Oblicz daty na podstawie miesiąca i roku
      const firstDayOfMonth = new Date(report.year, report.month - 1, 1);
      const lastDayOfMonth = new Date(report.year, report.month, 0);
      
          const dateFrom = getFirstDayOfMonth(report.year, report.month);
          const dateTo = getLastDayOfMonth(report.year, report.month);
      
      console.log('📅 Okres przeliczania:', dateFrom, 'do', dateTo);
      console.log('📍 Lokalizacja:', report.location_id);
      
      // Pobierz saldo otwarcia
      const openingBalance = await getOpeningBalance(report.location_id, report.month, report.year);
      
      // Oblicz finansowe podsumowanie zgodnie z określonymi kontami:
      // - Przychody: konta 700-799 i 200-299 po stronie KREDYTU
      // - Koszty: konta 400-499 po stronie DEBETU
      const summary = await calculateFinancialSummary(report.location_id, dateFrom, dateTo);
      
      console.log('💰 Obliczone podsumowanie:', summary);
      console.log('💳 Saldo otwarcia:', openingBalance);
      
      // Aktualizuj szczegóły raportu w bazie danych
      await updateReportDetails(reportId, { ...summary, openingBalance });
      
      // Odśwież dane bez reload strony
      await refetchFinancial();
      
      toast({
        title: "Sumy przeliczone",
        description: `Saldo otwarcia: ${openingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}, Przychody: ${summary.income.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}, Koszty: ${summary.expense.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}`,
      });
    } catch (error) {
      console.error('❌ Błąd podczas odświeżania sum:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas przeliczania sum.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Funkcja do składania raportu z powiadomieniem email
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

      // Zablokuj dokumenty z tego okresu
      if (report) {
        const reportMonth = report.month;
        const reportYear = report.year;
        const locationId = report.location_id;
        const startDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(reportYear, reportMonth, 0).getDate();
        const endDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { error: lockError } = await supabase
          .from('documents')
          .update({ 
            validation_errors: [{ type: 'locked_by_report', reportId, message: 'Dokument zablokowany - raport złożony' }]
          })
          .eq('location_id', locationId)
          .gte('document_date', startDateStr)
          .lte('document_date', endDateStr);

        if (lockError) {
          console.error('Błąd blokowania dokumentów:', lockError);
        } else {
          console.log('Dokumenty zablokowane po złożeniu raportu');
        }
      }

      // Wyślij powiadomienie email do prowincjała
      try {
        console.log('Wysyłanie powiadomienia email...');
        
        const { data, error: emailError } = await supabase.functions.invoke('send-report-notification', {
          body: {
            reportId: reportId,
            reportTitle: report?.title || 'Raport',
            submittedBy: user?.name || 'Nieznany użytkownik',
            locationName: report?.location?.name || 'Nieznana placówka',
            period: report?.period || 'Nieznany okres'
          }
        });

        if (emailError) {
          console.error('Błąd wysyłania powiadomienia email:', emailError);
          // Nie przerywamy procesu - raport jest już złożony
          toast({
            title: "Uwaga",
            description: "Raport został złożony, ale wystąpił problem z wysłaniem powiadomienia email.",
            variant: "default",
          });
        } else {
          console.log('Powiadomienie email wysłane pomyślnie:', data);
        }
      } catch (emailError) {
        console.error('Błąd podczas wysyłania powiadomienia:', emailError);
        // Nie przerywamy procesu - raport jest już złożony
      }
      
      // Odśwież dane raportu bez reload strony
      await refetchReport();
      
      toast({
        title: "Raport złożony",
        description: "Raport został złożony do sprawdzenia. Prowincjał otrzyma powiadomienie email.",
      });
      window.location.reload();
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
        return 'text-yellow-600 bg-yellow-100 px-2 py-1 rounded-md';
      case 'submitted':
        return 'text-blue-600 bg-blue-100 px-2 py-1 rounded-md';
      case 'approved':
        return 'text-green-600 bg-green-100 px-2 py-1 rounded-md';
      case 'to_be_corrected':
        return 'text-orange-600 bg-orange-100 px-2 py-1 rounded-md';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="text-omi-gray-500 mt-2">
            Status: <span className={getStatusClass(report.status)}>{getStatusLabel(report.status)}</span>
          </p>
        </div>
        
        <div className="flex gap-2">
          <ExportToExcelFull
            report={report}
            locationName={report.location?.name || 'Nieznana'}
          />
          {(report.status === 'draft' || canResubmit) && (user?.role === 'ekonom' || user?.role === 'proboszcz') && (
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
      {canApproveReports && (report?.status === 'submitted' || report?.status === 'approved') && (
        <ReportApprovalActions 
          reportId={reportId!} 
          reportMonth={report.month}
          reportYear={report.year}
          locationId={report.location_id}
          currentStatus={report.status}
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

      {/* Przycisk przeliczania sum dla raportów roboczych */}
      {shouldShowRecalculateButton && (
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshSums} 
            disabled={isRefreshing}
            title="Przelicza sumaryczne przychody i koszty na podstawie wszystkich transakcji w okresie oraz pobiera saldo otwarcia."
          >
            {isRefreshing ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <RefreshCcwIcon size={16} className="mr-2" />
            )}
            Przelicz sumy
          </Button>
        </div>
      )}

      {/* Pełny widok raportu zgodny ze wzorem */}
      {report && (
        <ReportViewFull
          report={report}
          locationId={report.location_id}
          month={report.month}
          year={report.year}
        />
      )}

      {/* Szczegółowa rozpiska kont PRZED sekcji stanu kasowego */}
      {report && (
        <ReportAccountsBreakdown
          reportId={reportId!}
          locationId={report.location_id}
          month={report.month}
          year={report.year}
        />
      )}


    </div>
  );
};

export default ReportDetails;
