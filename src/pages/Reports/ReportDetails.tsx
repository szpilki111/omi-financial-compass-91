
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Report } from '@/types/reports';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { getReportFinancialDetails } from '@/utils/financeUtils';

interface ReportDetailsProps {
  reportId: string;
}

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

const ReportDetails: React.FC<ReportDetailsProps> = ({ reportId }) => {
  const { user, canReviewReports } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pobierz szczegóły raportu
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          location:locations(name),
          submitted_by_profile:profiles!submitted_by(name),
          reviewed_by_profile:profiles!reviewed_by(name)
        `)
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data as Report;
    }
  });

  // Pobierz szczegóły finansowe
  const { data: financialDetails, isLoading: financialLoading } = useQuery({
    queryKey: ['reportFinancialDetails', reportId],
    queryFn: () => getReportFinancialDetails(reportId),
    enabled: !!reportId
  });

  // Pobierz szczegóły kont dla raportu
  const { data: accountDetails, isLoading: accountDetailsLoading } = useQuery({
    queryKey: ['reportAccountDetails', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_account_details')
        .select('*')
        .eq('report_id', reportId)
        .order('account_number');

      if (error) throw error;
      return data;
    }
  });

  // Mutacja do złożenia raportu
  const submitReportMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: user?.id
        })
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: "Sukces",
        description: "Raport został złożony pomyślnie",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Wystąpił błąd podczas składania raportu",
        variant: "destructive",
      });
    }
  });

  const isLoading = reportLoading || financialLoading || accountDetailsLoading;

  if (isLoading) {
    return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  }

  if (!report) {
    return <div className="text-red-600 p-4">Nie znaleziono raportu</div>;
  }

  const canSubmit = report.status === 'draft' && user?.id;
  const reportTypeLabel = report.report_type === 'monthly' ? 'Miesięczny' : 'Roczny';

  // Grupuj szczegóły kont według typu
  const incomeAccounts = accountDetails?.filter(account => account.account_type === 'income') || [];
  const expenseAccounts = accountDetails?.filter(account => account.account_type === 'expense') || [];

  return (
    <div className="space-y-6">
      {/* Podstawowe informacje o raporcie */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{report.title}</CardTitle>
              <p className="text-omi-gray-600 mt-1">
                Typ: {reportTypeLabel} | Placówka: {report.location?.name}
              </p>
            </div>
            <Badge {...getStatusBadgeProps(report.status)}>
              {getStatusLabel(report.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-omi-gray-600">Okres</p>
              <p className="font-semibold">{report.period}</p>
            </div>
            <div>
              <p className="text-sm text-omi-gray-600">Data utworzenia</p>
              <p className="font-semibold">
                {new Date(report.created_at).toLocaleDateString('pl-PL')}
              </p>
            </div>
            {report.submitted_by_profile && (
              <div>
                <p className="text-sm text-omi-gray-600">Złożony przez</p>
                <p className="font-semibold">{report.submitted_by_profile.name}</p>
              </div>
            )}
            {report.reviewed_by_profile && (
              <div>
                <p className="text-sm text-omi-gray-600">Sprawdzony przez</p>
                <p className="font-semibold">{report.reviewed_by_profile.name}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Podsumowanie finansowe */}
      <Card>
        <CardHeader>
          <CardTitle>Podsumowanie finansowe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 mb-1">Saldo początkowe</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(financialDetails?.openingBalance)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 mb-1">Przychody</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(financialDetails?.income)}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-600 mb-1">Rozchody</p>
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(financialDetails?.expense)}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-600 mb-1">Saldo okresu</p>
              <p className={`text-2xl font-bold ${financialDetails?.balance && financialDetails.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(financialDetails?.balance)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 mb-1">Saldo końcowe</p>
              <p className={`text-2xl font-bold ${financialDetails?.closingBalance && financialDetails.closingBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(financialDetails?.closingBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Szczegóły kont - przychody */}
      {incomeAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Szczegóły przychodów według kont</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer konta</TableHead>
                  <TableHead>Nazwa konta</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeAccounts.map((account) => (
                  <TableRow key={`${account.account_id}_income`}>
                    <TableCell className="font-mono">{account.account_number}</TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">
                      {formatCurrency(account.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-green-50">
                  <TableCell colSpan={2}>Suma przychodów</TableCell>
                  <TableCell className="text-right font-mono text-green-700">
                    {formatCurrency(incomeAccounts.reduce((sum, acc) => sum + acc.total_amount, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Szczegóły kont - koszty */}
      {expenseAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Szczegóły kosztów według kont</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer konta</TableHead>
                  <TableHead>Nazwa konta</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseAccounts.map((account) => (
                  <TableRow key={`${account.account_id}_expense`}>
                    <TableCell className="font-mono">{account.account_number}</TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell className="text-right font-mono text-red-700">
                      {formatCurrency(account.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-red-50">
                  <TableCell colSpan={2}>Suma kosztów</TableCell>
                  <TableCell className="text-right font-mono text-red-700">
                    {formatCurrency(expenseAccounts.reduce((sum, acc) => sum + acc.total_amount, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Komentarze */}
      {report.comments && (
        <Card>
          <CardHeader>
            <CardTitle>Komentarze</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={report.comments}
              readOnly
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>
      )}

      {/* Akcje */}
      {canSubmit && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Button 
                onClick={() => submitReportMutation.mutate()}
                disabled={submitReportMutation.isPending}
                size="lg"
              >
                {submitReportMutation.isPending ? 'Składanie...' : 'Złóż raport'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportDetails;
