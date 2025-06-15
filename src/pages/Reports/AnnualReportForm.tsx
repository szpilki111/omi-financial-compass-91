
import React from 'react';
import ReportForm from './ReportForm';

interface AnnualReportFormProps {
  reportId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const AnnualReportForm: React.FC<AnnualReportFormProps> = ({ 
  reportId, 
  onSuccess, 
  onCancel 
}) => {
  return (
    <ReportForm
      reportId={reportId}
      reportType="annual"
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
};

export default AnnualReportForm;
