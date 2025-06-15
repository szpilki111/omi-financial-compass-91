
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import ReportsList from './ReportsList';
import AnnualReportsList from './AnnualReportsList';

const ReportsPage = () => {
  const [showAnnualReports, setShowAnnualReports] = useState(false);
  const navigate = useNavigate();

  const handleReportSelect = (reportId: string) => {
    navigate(`/reports/${reportId}`);
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
          <Button 
            variant="outline" 
            onClick={() => setShowAnnualReports(true)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Raporty roczne
          </Button>
        </div>
        
        <ReportsList onReportSelect={handleReportSelect} reportType="monthly" />
      </div>
    </MainLayout>
  );
};

export default ReportsPage;
