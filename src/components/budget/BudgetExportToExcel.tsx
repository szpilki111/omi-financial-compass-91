import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface YearData {
  year: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

interface AccountData {
  prefix: string;
  name: string;
  type: 'income' | 'expense';
  years: { [year: number]: number };
}

interface BudgetExportToExcelProps {
  locationName: string;
  years: number[];
  yearData: YearData[];
  accountsData: AccountData[];
}

export const BudgetExportToExcel: React.FC<BudgetExportToExcelProps> = ({
  locationName,
  years,
  yearData,
  accountsData
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryHeaders = ['Rok', 'Przychody', 'Rozchody', 'Bilans'];
      const summaryData = [
        ['PORÓWNANIE BUDŻETÓW WIELOLETNICH'],
        ['Placówka:', locationName],
        [''],
        summaryHeaders,
        ...yearData.map(yd => [
          yd.year,
          yd.totalIncome,
          yd.totalExpense,
          yd.balance
        ])
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Podsumowanie');

      // Income accounts sheet
      const incomeAccounts = accountsData.filter(a => a.type === 'income');
      if (incomeAccounts.length > 0) {
        const incomeHeaders = ['Konto', 'Nazwa', ...years.map(y => y.toString())];
        const incomeData = [
          ['PRZYCHODY - PORÓWNANIE WIELOLETNIE'],
          [''],
          incomeHeaders,
          ...incomeAccounts.map(a => [
            a.prefix,
            a.name,
            ...years.map(y => a.years[y] || 0)
          ]),
          [''],
          ['SUMA', '', ...years.map(y => 
            incomeAccounts.reduce((sum, a) => sum + (a.years[y] || 0), 0)
          )]
        ];

        const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);
        incomeSheet['!cols'] = [
          { wch: 12 },
          { wch: 35 },
          ...years.map(() => ({ wch: 15 }))
        ];
        XLSX.utils.book_append_sheet(wb, incomeSheet, 'Przychody');
      }

      // Expense accounts sheet
      const expenseAccounts = accountsData.filter(a => a.type === 'expense');
      if (expenseAccounts.length > 0) {
        const expenseHeaders = ['Konto', 'Nazwa', ...years.map(y => y.toString())];
        const expenseData = [
          ['ROZCHODY - PORÓWNANIE WIELOLETNIE'],
          [''],
          expenseHeaders,
          ...expenseAccounts.map(a => [
            a.prefix,
            a.name,
            ...years.map(y => a.years[y] || 0)
          ]),
          [''],
          ['SUMA', '', ...years.map(y => 
            expenseAccounts.reduce((sum, a) => sum + (a.years[y] || 0), 0)
          )]
        ];

        const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
        expenseSheet['!cols'] = [
          { wch: 12 },
          { wch: 35 },
          ...years.map(() => ({ wch: 15 }))
        ];
        XLSX.utils.book_append_sheet(wb, expenseSheet, 'Rozchody');
      }

      const filename = `budzet_porownanie_${locationName.replace(/\s+/g, '_')}_${years[0]}-${years[years.length - 1]}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success('Porównanie budżetów wyeksportowane do Excel');
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

export default BudgetExportToExcel;
