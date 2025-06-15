
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, FileText } from 'lucide-react';
import ReportsList from './ReportsList';
import AnnualReportsList from './AnnualReportsList';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('monthly');
  const navigate = useNavigate();

  const handleReportSelect = (reportId: string) => {
    navigate(`/reports/${reportId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle title="Raporty" />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Raporty miesięczne
            </TabsTrigger>
            <TabsTrigger value="annual" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Raporty roczne
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="monthly" className="mt-6">
            <ReportsList onReportSelect={handleReportSelect} />
          </TabsContent>
          
          <TabsContent value="annual" className="mt-6">
            <AnnualReportsList />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ReportsPage;
