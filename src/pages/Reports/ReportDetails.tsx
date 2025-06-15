import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getReportFinancialDetails, calculateAndSaveReportSummary } from '@/utils/financeUtils';
import { 
  FileText, 
  Calendar, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  RefreshCw,
  Edit3,
  Check,
  X,
  Calculator
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface ReportDetailsProps {
  reportId: string;
}

interface DatabaseReport {
  id: string;
  title: string;
  period: string;
  comments: string | null;
  location_id: string;
  year: number;
  month: number | null;
  report_type: 'monthly' | 'annual' | 'standard' | 'zos' | 'bilans' | 'rzis' | 'jpk' | 'analiza';
  status: string;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  location: { name: string };
  submitted_by_profile: { email: string } | null;
}

interface AccountDetail {
  account_id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  total_amount: number;
}

const ReportDetails: React.FC<ReportDetailsProps> = ({ reportId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [report, setReport] = useState<DatabaseReport | null>(null);
  const [financialDetails, setFinancialDetails] = useState({
    income: 0,
    expense: 0,
    balance: 0,
    settlements: 0,
    openingBalance: 0,
    closingBalance: 0
  });
  const [accountDetails, setAccountDetails] = useState<AccountDetail[]>([]);

  useEffect(() => {
    fetchReportDetails();
  }, [reportId]);

  const fetchReportDetails = async () => {
    setLoading(true);
    try {
      // Pobierz dane raportu
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select(`
          *,
          location:locations(name),
          submitted_by_profile:profiles(email)
        `)
        .eq('id', reportId)
        .single();

      if (reportError) throw reportError;
      
      // Cast the status to proper type to avoid TypeScript errors
      const typedReportData = {
        ...reportData,
        status: reportData.status as 'draft' | 'submitted' | 'approved' | 'to_be_corrected'
      } as DatabaseReport;
      
      setReport(typedReportData);

      // Pobierz szczegóły finansowe
      const details = await getReportFinancialDetails(reportId);
      setFinancialDetails(details);

      // Pobierz szczegóły kont
      const { data: accountData, error: accountError } = await supabase
        .from('report_account_details')
        .select('*')
        .eq('report_id', reportId)
        .order('account_number');

      if (accountError) throw accountError;
      setAccountDetails(accountData || []);

    } catch (error: any) {
      console.error('Error fetching report details:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać szczegółów raportu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!report) return;
    
    setRecalculating(true);
    try {
      await calculateAndSaveReportSummary(
        reportId,
        report.location_id,
        report.month,
        report.year
      );
      
      // Odśwież dane
      await fetchReportDetails();
      
      toast({
        title: "Sukces",
        description: "Raport został ponownie obliczony",
      });
    } catch (error: any) {
      console.error('Error recalculating report:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się ponownie obliczyć raportu",
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Szkic', variant: 'secondary' as const },
      submitted: { label: 'Przesłany', variant: 'default' as const },
      approved: { label: 'Zatwierdzony', variant: 'default' as const },
      to_be_corrected: { label: 'Do poprawy', variant: 'destructive' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                   { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const getPeriodText = (report: DatabaseReport) => {
    if (report.report_type === 'annual') {
      return `Rok ${report.year}`;
    }
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return `${monthNames[report.month! - 1]} ${report.year}`;
  };

  // Grupowanie kont według typu
  const groupedAccounts = {
    income: accountDetails.filter(acc => acc.account_type === 'income'),
    expense: accountDetails.filter(acc => acc.account_type === 'expense')
  };

  // Konta przychodowe (7xx)
  const incomeAccount7xx = groupedAccounts.income.filter(acc => acc.account_number.startsWith('7'));
  
  // Konta kosztowe (4xx, 5xx)
  const expenseAccount4xx = groupedAccounts.expense.filter(acc => acc.account_number.startsWith('4'));
  const expenseAccount5xx = groupedAccounts.expense.filter(acc => acc.account_number.startsWith('5'));
  
  // Konto 200 (może być w przychodach lub kosztach)
  const account200Income = groupedAccounts.income.filter(acc => acc.account_number === '200');
  const account200Expense = groupedAccounts.expense.filter(acc => acc.account_number === '200');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Ładowanie szczegółów raportu...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center p-8">
        <p>Nie znaleziono raportu</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek raportu */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {report.report_type === 'annual' ? (
                  <Calendar className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                {report.title || report.period}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {report.location.name}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {getPeriodText(report)}
                </div>
                {getStatusBadge(report.status)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                {recalculating ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Calculator className="h-4 w-4 mr-1" />
                )}
                Przelicz
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {report.comments && (
            <p className="text-gray-700">{report.comments}</p>
          )}
          <div className="mt-4 text-sm text-gray-500">
            <p>Utworzony: {format(new Date(report.created_at), 'dd MMMM yyyy, HH:mm', { locale: pl })}</p>
            <p>Ostatnia aktualizacja: {format(new Date(report.updated_at), 'dd MMMM yyyy, HH:mm', { locale: pl })}</p>
          </div>
        </CardContent>
      </Card>

      {/* Podsumowanie finansowe z saldami */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {financialDetails.openingBalance !== 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Saldo początkowe</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(financialDetails.openingBalance)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Przychody</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(financialDetails.income)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rozchody</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(financialDetails.expense)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Saldo końcowe</p>
                <p className={`text-2xl font-bold ${financialDetails.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialDetails.closingBalance)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Szczegółowy podział kont */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Przychody */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Przychody
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Konta 7xx */}
            {incomeAccount7xx.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-gray-600 mb-2">Konta przychodowe (7xx)</h4>
                <div className="space-y-2">
                  {incomeAccount7xx.map((account) => (
                    <div key={`${account.account_id}_${account.account_type}`} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <div>
                        <span className="font-medium">{account.account_number}</span>
                        <span className="text-sm text-gray-600 ml-2">{account.account_name}</span>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(account.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Konto 200 (przychody) */}
            {account200Income.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-gray-600 mb-2">Konto 200 (przychody)</h4>
                <div className="space-y-2">
                  {account200Income.map((account) => (
                    <div key={`${account.account_id}_${account.account_type}`} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <div>
                        <span className="font-medium">{account.account_number}</span>
                        <span className="text-sm text-gray-600 ml-2">{account.account_name}</span>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(account.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {groupedAccounts.income.length === 0 && (
              <p className="text-gray-500 text-center py-4">Brak przychodów w tym okresie</p>
            )}
          </CardContent>
        </Card>

        {/* Rozchody */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" />
              Rozchody
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Konta 4xx */}
            {expenseAccount4xx.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-gray-600 mb-2">Koszty działalności (4xx)</h4>
                <div className="space-y-2">
                  {expenseAccount4xx.map((account) => (
                    <div key={`${account.account_id}_${account.account_type}`} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <div>
                        <span className="font-medium">{account.account_number}</span>
                        <span className="text-sm text-gray-600 ml-2">{account.account_name}</span>
                      </div>
                      <span className="font-medium text-red-600">
                        {formatCurrency(account.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Konta 5xx */}
            {expenseAccount5xx.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-gray-600 mb-2">Pozostałe koszty (5xx)</h4>
                <div className="space-y-2">
                  {expenseAccount5xx.map((account) => (
                    <div key={`${account.account_id}_${account.account_type}`} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <div>
                        <span className="font-medium">{account.account_number}</span>
                        <span className="text-sm text-gray-600 ml-2">{account.account_name}</span>
                      </div>
                      <span className="font-medium text-red-600">
                        {formatCurrency(account.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Konto 200 (rozchody) */}
            {account200Expense.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm text-gray-600 mb-2">Konto 200 (rozchody)</h4>
                <div className="space-y-2">
                  {account200Expense.map((account) => (
                    <div key={`${account.account_id}_${account.account_type}`} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <div>
                        <span className="font-medium">{account.account_number}</span>
                        <span className="text-sm text-gray-600 ml-2">{account.account_name}</span>
                      </div>
                      <span className="font-medium text-red-600">
                        {formatCurrency(account.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {groupedAccounts.expense.length === 0 && (
              <p className="text-gray-500 text-center py-4">Brak rozchodów w tym okresie</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportDetails;
