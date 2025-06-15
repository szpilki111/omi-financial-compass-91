
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import ReportsList from './ReportsList';
import ReportForm from './ReportForm';
import ReportDetails from './ReportDetails';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowLeft, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const ReportsPage = () => {
  const navigate = useNavigate();
  const { canCreateReports } = useAuth();
  const [searchParams] = useSearchParams();
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'edit' | 'view'>('list');
  const [reportType, setReportType] = useState<'standard' | 'annual'>('standard');
  const { toast } = useToast();

  // Sprawdź parametr URL przy załadowaniu komponentu
  useEffect(() => {
    const action = searchParams.get('action');
    const type = searchParams.get('type') as 'standard' | 'annual';
    if (action === 'new' && canCreateReports) {
      handleNewReport(type || 'standard');
    }
  }, [searchParams, canCreateReports]);

  const handleReportCreated = () => {
    setIsCreatingReport(false);
    setViewMode('list');
    // Usuń parametr z URL
    navigate('/reports', { replace: true });
    toast({
      title: "Sukces",
      description: "Raport został utworzony pomyślnie.",
      variant: "default",
    });
  };

  const handleReportSelected = (reportId: string) => {
    setSelectedReportId(reportId);
    setIsCreatingReport(false);
    setViewMode('view');
  };

  const handleNewReport = (type: 'standard' | 'annual' = 'standard') => {
    setIsCreatingReport(true);
    setSelectedReportId(null);
    setReportType(type);
    setViewMode('edit');
  };

  const handleCancel = () => {
    setIsCreatingReport(false);
    setSelectedReportId(null);
    setViewMode('list');
    // Usuń parametr z URL
    navigate('/reports', { replace: true });
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          {viewMode !== 'list' && (
            <Button 
              variant="ghost" 
              onClick={handleCancel} 
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Powrót
            </Button>
          )}
          <PageTitle title="Raportowanie" />
        </div>
        {/* Przyciski tworzenia raportów tylko dla ekonomów */}
        {viewMode === 'list' && canCreateReports && (
          <div className="flex gap-2">
            <Button onClick={() => handleNewReport('standard')} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Nowy raport miesięczny
            </Button>
            <Button onClick={() => handleNewReport('annual')} variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Nowy raport roczny
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'edit' && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            {isCreatingReport ? `Nowy raport ${reportType === 'annual' ? 'roczny' : 'miesięczny'}` : 'Edycja raportu'}
          </h2>
          <ReportForm 
            reportId={selectedReportId || undefined} 
            reportType={reportType}
            onSuccess={handleReportCreated} 
            onCancel={handleCancel} 
          />
        </div>
      )}
      
      {viewMode === 'view' && selectedReportId && (
        <ReportDetails reportId={selectedReportId} />
      )}
      
      {viewMode === 'list' && (
        <ReportsList onReportSelect={handleReportSelected} />
      )}
    </MainLayout>
  );
};

export default ReportsPage;
