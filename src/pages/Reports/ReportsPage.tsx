
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import ReportsList from './ReportsList';
import ReportForm from './ReportForm';
import ReportDetails from './ReportDetails';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowLeft } from 'lucide-react';
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
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  // Sprawdź parametr URL przy załadowaniu komponentu
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new' && canCreateReports) {
      handleNewReport();
    }
  }, [searchParams, canCreateReports]);

  const handleReportCreated = () => {
    setIsCreatingReport(false);
    setViewMode('list');
    setRefreshKey(prev => prev + 1); // Odśwież listę raportów
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

  const handleNewReport = () => {
    setIsCreatingReport(true);
    setSelectedReportId(null);
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
        {/* Przycisk "Nowy raport" tylko dla ekonomów */}
        {viewMode === 'list' && canCreateReports && (
          <Button onClick={handleNewReport} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Nowy raport
          </Button>
        )}
      </div>

      {viewMode === 'edit' && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            {isCreatingReport ? 'Nowy raport' : 'Edycja raportu'}
          </h2>
          <ReportForm 
            reportId={selectedReportId || undefined} 
            onSuccess={handleReportCreated} 
            onCancel={handleCancel} 
          />
        </div>
      )}
      
      {viewMode === 'view' && selectedReportId && (
        <ReportDetails reportId={selectedReportId} />
      )}
      
      {viewMode === 'list' && (
        <ReportsList 
          onReportSelect={handleReportSelected} 
          key={refreshKey} // Wymusza odświeżenie listy po utworzeniu raportu
        />
      )}
    </MainLayout>
  );
};

export default ReportsPage;
