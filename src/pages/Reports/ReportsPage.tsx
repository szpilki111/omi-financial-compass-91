
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus } from 'lucide-react';
import ReportsList from './ReportsList';
import AnnualReportsList from './AnnualReportsList';
import ReportForm from './ReportForm';

const ReportsPage = () => {
  const [showAnnualReports, setShowAnnualReports] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const navigate = useNavigate();

  const handleReportSelect = (reportId: string) => {
    navigate(`/reports/${reportId}`);
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    // Refresh the page to show the new report
    window.location.reload();
  };

  const handleCreateCancel = () => {
    setShowCreateDialog(false);
  };

  if (showAnnualReports) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <PageTitle title="Raporty roczne" />
            <Button 
              variant="outline" 
              onClick={() => setShowAnnualReports(false)}
            >
              Powrót do raportów miesięcznych
            </Button>
          </div>
          <AnnualReportsList />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageTitle title="Raporty miesięczne" />
          <div className="flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Utwórz raport miesięczny
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Utwórz nowy raport miesięczny</DialogTitle>
                </DialogHeader>
                <ReportForm
                  reportType="monthly"
                  onSuccess={handleCreateSuccess}
                  onCancel={handleCreateCancel}
                />
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="outline" 
              onClick={() => setShowAnnualReports(true)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Raporty roczne
            </Button>
          </div>
        </div>
        
        <ReportsList onReportSelect={handleReportSelect} reportType="monthly" />
      </div>
    </MainLayout>
  );
};

export default ReportsPage;
