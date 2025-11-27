import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface ExportToExcelProps {
  reportId: string;
  reportTitle: string;
  locationName: string;
  period: string;
  year: number;
  month: number;
}

interface AccountBreakdown {
  accountNumber: string;
  accountName: string;
  totalAmount: number;
}

export const ExportToExcel: React.FC<ExportToExcelProps> = ({
  reportId,
  reportTitle,
  locationName,
  period,
  year,
  month
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch report details
      const { data: reportDetails, error: detailsError } = await supabase
        .from('report_details')
        .select('*')
        .eq('report_id', reportId)
        .single();

      if (detailsError) throw detailsError;

      // Fetch report account details
      const { data: accountDetails, error: accountsError } = await supabase
        .from('report_account_details')
        .select('*')
        .eq('report_id', reportId)
        .order('account_number');

      if (accountsError) throw accountsError;

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['RAPORT FINANSOWY'],
        [''],
        ['Placówka:', locationName],
        ['Okres:', period],
        ['Rok:', year],
        ['Miesiąc:', month],
        [''],
        ['PODSUMOWANIE FINANSOWE'],
        [''],
        ['Bilans otwarcia:', reportDetails?.opening_balance || 0],
        ['Przychody:', reportDetails?.income_total || 0],
        ['Rozchody:', reportDetails?.expense_total || 0],
        ['Rozliczenia:', reportDetails?.settlements_total || 0],
        ['Bilans:', reportDetails?.balance || 0],
        ['Bilans zamknięcia:', reportDetails?.closing_balance || 0],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      summarySheet['!cols'] = [
        { wch: 25 },
        { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, summarySheet, 'Podsumowanie');

      // Accounts breakdown sheet
      if (accountDetails && accountDetails.length > 0) {
        const incomeAccounts = accountDetails.filter(a => a.account_type === 'income');
        const expenseAccounts = accountDetails.filter(a => a.account_type === 'expense');

        // Income accounts sheet
        if (incomeAccounts.length > 0) {
          const incomeData = [
            ['PRZYCHODY'],
            [''],
            ['Numer konta', 'Nazwa konta', 'Kwota'],
            ...incomeAccounts.map(a => [a.account_number, a.account_name, a.total_amount]),
            [''],
            ['SUMA PRZYCHODÓW', '', incomeAccounts.reduce((sum, a) => sum + Number(a.total_amount), 0)]
          ];

          const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);
          incomeSheet['!cols'] = [
            { wch: 15 },
            { wch: 40 },
            { wch: 15 }
          ];
          XLSX.utils.book_append_sheet(wb, incomeSheet, 'Przychody');
        }

        // Expense accounts sheet
        if (expenseAccounts.length > 0) {
          const expenseData = [
            ['ROZCHODY'],
            [''],
            ['Numer konta', 'Nazwa konta', 'Kwota'],
            ...expenseAccounts.map(a => [a.account_number, a.account_name, a.total_amount]),
            [''],
            ['SUMA ROZCHODÓW', '', expenseAccounts.reduce((sum, a) => sum + Number(a.total_amount), 0)]
          ];

          const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
          expenseSheet['!cols'] = [
            { wch: 15 },
            { wch: 40 },
            { wch: 15 }
          ];
          XLSX.utils.book_append_sheet(wb, expenseSheet, 'Rozchody');
        }
      }

      // Generate filename
      const monthNames = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paz', 'lis', 'gru'];
      const filename = `raport_${locationName.replace(/\s+/g, '_')}_${monthNames[month - 1]}_${year}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success('Raport wyeksportowany do Excel');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Błąd eksportu: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      Eksport do Excel
    </Button>
  );
};

export default ExportToExcel;
