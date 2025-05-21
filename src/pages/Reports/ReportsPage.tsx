
import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageTitle } from '@/components/ui/PageTitle';
import ReportsList from './ReportsList';
import ReportForm from './ReportForm';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ReportsPage = () => {
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleReportCreated = () => {
    setIsCreatingReport(false);
    toast({
      title: "Sukces",
      description: "Raport został utworzony pomyślnie.",
      variant: "default",
    });
  };

  const handleReportSelected = (reportId: string) => {
    setSelectedReportId(reportId);
    setIsCreatingReport(false);
  };

  const handleNewReport = () => {
    setIsCreatingReport(true);
    setSelectedReportId(null);
  };

  const handleCancel = () => {
    setIsCreatingReport(false);
    setSelectedReportId(null);
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-4">
        <PageTitle>Raportowanie</PageTitle>
        {!isCreatingReport && !selectedReportId && (
          <Button onClick={handleNewReport} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Nowy raport
          </Button>
        )}
      </div>

      {isCreatingReport ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Nowy raport</h2>
          <ReportForm onSuccess={handleReportCreated} onCancel={handleCancel} />
        </div>
      ) : selectedReportId ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Edycja raportu</h2>
          <ReportForm reportId={selectedReportId} onCancel={handleCancel} />
        </div>
      ) : (
        <ReportsList onReportSelect={handleReportSelected} />
      )}
    </MainLayout>
  );
};

export default ReportsPage;
