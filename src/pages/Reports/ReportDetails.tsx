
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ReportApprovalActions from '@/components/reports/ReportApprovalActions';
import { ArrowLeft, FileText, Calendar, MapPin, Edit, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { getReportFinancialDetails, calculateAndSaveReportSummary } from '@/utils/financeUtils';

const ReportDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingComments, setIsEditingComments] = useState(false);
  const [editedComments, setEditedComments] = useState('');
  const [financialDetails, setFinancialDetails] = useState({
    income: 0,
    expense: 0,
    balance: 0,
    settlements: 0,
    openingBalance: 0,
    closingBalance: 0
  });

  // Fetch report data
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      if (!id) throw new Error('Report ID is required');
      
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          locations(name),
          submitted_by_profile:profiles!reports_submitted_by_fkey(name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Fetch financial details
  useEffect(() => {
    if (id) {
      getReportFinancialDetails(id).then(details => {
        setFinancialDetails(details);
      });
    }
  }, [id]);

  const updateCommentsMutation = useMutation({
    mutationFn: async (newComments: string) => {
      if (!id) throw new Error('Report ID is required');
      
      const { error } = await supabase
        .from('reports')
        .update({ 
          comments: newComments,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      setIsEditingComments(false);
      toast({
        title: "Sukces",
        description: "Komentarze zostały zaktualizowane",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować komentarzy",
        variant: "destructive",
      });
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      if (!id || !reportData) throw new Error('Report data is required');
      
      return await calculateAndSaveReportSummary(
        id,
        reportData.location_id,
        reportData.month,
        reportData.year
      );
    },
    onSuccess: (newDetails) => {
      setFinancialDetails({
        income: newDetails.income,
        expense: newDetails.expense,
        balance: newDetails.balance,
        settlements: 0,
        openingBalance: newDetails.openingBalance || 0,
        closingBalance: newDetails.closingBalance || 0
      });
      refetch();
      toast({
        title: "Sukces",
        description: "Dane finansowe zostały przeliczone",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: "Nie udało się przeliczyć danych finansowych",
        variant: "destructive",
      });
    }
  });

  const handleEditComments = () => {
    setEditedComments(reportData?.comments || '');
    setIsEditingComments(true);
  };

  const handleSaveComments = () => {
    updateCommentsMutation.mutate(editedComments);
  };

  const handleCancelEdit = () => {
    setIsEditingComments(false);
    setEditedComments('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'submitted':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Szkic';
      case 'submitted':
        return 'Wysłany';
      case 'approved':
        return 'Zatwierdzony';
      case 'rejected':
        return 'Odrzucony';
      default:
        return 'Nieznany';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!reportData) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Raport nie został znaleziony</h2>
          <Button onClick={() => navigate('/raporty')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót do listy raportów
          </Button>
        </div>
      </MainLayout>
    );
  }

  const canEdit = user?.role === 'admin' || user?.role === 'prowincjal' || reportData.submitted_by === user?.id;
  const canApprove = user?.role === 'admin' || user?.role === 'prowincjal';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/raporty')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{reportData.title}</h1>
              <p className="text-gray-600">
                {reportData.report_type === 'monthly' ? 'Raport miesięczny' : 'Raport roczny'} • {reportData.period}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(reportData.status)}>
              {getStatusText(reportData.status)}
            </Badge>
            {canEdit && reportData.status === 'draft' && (
              <Button
                onClick={() => recalculateMutation.mutate()}
                disabled={recalculateMutation.isPending}
                variant="outline"
                size="sm"
              >
                Przelicz dane
              </Button>
            )}
          </div>
        </div>

        {/* Report Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informacje o raporcie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Typ raportu:</label>
                <p className="text-gray-900">
                  {reportData.report_type === 'monthly' ? 'Miesięczny' : 'Roczny'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Okres:</label>
                <p className="flex items-center gap-1 text-gray-900">
                  <Calendar className="h-4 w-4" />
                  {reportData.period}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Lokalizacja:</label>
                <p className="flex items-center gap-1 text-gray-900">
                  <MapPin className="h-4 w-4" />
                  {reportData.locations?.name || 'Nieznana'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Utworzony przez:</label>
                <p className="text-gray-900">
                  {reportData.submitted_by_profile?.name || 'Nieznany użytkownik'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Data utworzenia:</label>
                <p className="text-gray-900">
                  {format(new Date(reportData.created_at), 'dd MMMM yyyy, HH:mm', { locale: pl })}
                </p>
              </div>

              {reportData.updated_at !== reportData.created_at && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Ostatnia aktualizacja:</label>
                  <p className="text-gray-900">
                    {format(new Date(reportData.updated_at), 'dd MMMM yyyy, HH:mm', { locale: pl })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Podsumowanie finansowe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-blue-600">Saldo początkowe:</label>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(financialDetails.openingBalance)}
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-green-600">Przychody:</label>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(financialDetails.income)}
                </p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-red-600">Rozchody:</label>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(financialDetails.expense)}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-gray-600">Saldo okresu:</label>
                <p className={`text-2xl font-bold ${financialDetails.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialDetails.balance)}
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <label className="text-sm font-medium text-purple-600">Saldo końcowe:</label>
                <p className={`text-2xl font-bold ${financialDetails.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialDetails.closingBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Komentarze
              {canEdit && reportData.status === 'draft' && !isEditingComments && (
                <Button variant="outline" size="sm" onClick={handleEditComments}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edytuj
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditingComments ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="comments">Komentarze</Label>
                  <Textarea
                    id="comments"
                    value={editedComments}
                    onChange={(e) => setEditedComments(e.target.value)}
                    placeholder="Dodaj komentarze do raportu..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveComments}
                    disabled={updateCommentsMutation.isPending}
                    size="sm"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Zapisz
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit}
                    size="sm"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Anuluj
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-gray-700">
                {reportData.comments || 'Brak komentarzy'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Actions */}
        {canApprove && reportData.status === 'submitted' && (
          <ReportApprovalActions
            reportId={id!}
            onApprovalComplete={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['reports'] });
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default ReportDetails;
