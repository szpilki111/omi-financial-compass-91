import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';

interface ExportToExcelFullProps {
  report: Report;
  locationName: string;
}

// Predefiniowane konta przychodów zgodne ze wzorem
const INCOME_ACCOUNTS = [
  { number: '210', name: 'Intencje przyjęte' },
  { number: '212', name: 'Zwrot pożyczki' },
  { number: '215', name: 'Zaciągnięte pożyczki' },
  { number: '217', name: 'Sumy przechodnie' },
  { number: '225', name: 'Sprzedaż towarów' },
  { number: '701', name: 'Intencje odprawione na dom' },
  { number: '702', name: 'Duszpasterstwo OMI' },
  { number: '703', name: 'Stałe ofiary' },
  { number: '704', name: 'Ofiary z nabożeństw' },
  { number: '705', name: 'Kolęda, opłatek' },
  { number: '706', name: 'Ofiary okazjonalne' },
  { number: '707', name: 'Stypendia, dotacje, emerytury' },
  { number: '708', name: 'Dotacje z kurii' },
  { number: '709', name: 'Wynajem, dzierżawa' },
  { number: '710', name: 'Darowizny' },
  { number: '711', name: 'Różne wpływy' },
  { number: '712', name: 'Spadki, zapisy' },
  { number: '713', name: 'Przychód ze sprzedaży' },
  { number: '714', name: 'Odsetki bankowe' },
  { number: '715', name: 'Dotacje z funduszy UE' },
  { number: '716', name: 'Dochód ze składek' },
  { number: '717', name: 'Dochód z działalności' },
  { number: '725', name: 'Inne przychody' },
  { number: '730', name: 'Przychody finansowe' },
];

// Predefiniowane konta rozchodów zgodne ze wzorem
const EXPENSE_ACCOUNTS = [
  { number: '210', name: 'Intencje odprawione i oddane' },
  { number: '212', name: 'Udzielone pożyczki' },
  { number: '215', name: 'Spłata pożyczek' },
  { number: '217', name: 'Sumy przechodnie' },
  { number: '225', name: 'Zakup towarów' },
  { number: '401', name: 'Żywność' },
  { number: '402', name: 'Alkohol' },
  { number: '403', name: 'Opłaty za energię' },
  { number: '404', name: 'Opłaty telefoniczne' },
  { number: '405', name: 'Opłaty komunalne' },
  { number: '406', name: 'Transport' },
  { number: '407', name: 'Opłaty administracyjne' },
  { number: '408', name: 'Ubezpieczenia' },
  { number: '409', name: 'Remonty, naprawy' },
  { number: '410', name: 'Wyposażenie' },
  { number: '411', name: 'Materiały biurowe' },
  { number: '412', name: 'Prenumerata, książki' },
  { number: '413', name: 'Środki czystości' },
  { number: '414', name: 'Odzież' },
  { number: '415', name: 'Leczenie' },
  { number: '416', name: 'Formacja, studia' },
  { number: '417', name: 'Duszpasterstwo' },
  { number: '418', name: 'Podróże służbowe' },
  { number: '419', name: 'Urlopy, rekolekcje' },
  { number: '420', name: 'Reprezentacja' },
  { number: '421', name: 'Wynagrodzenia' },
  { number: '422', name: 'ZUS' },
  { number: '423', name: 'Usługi obce' },
  { number: '424', name: 'Inwestycje' },
  { number: '425', name: 'Wydatki bankowe' },
  { number: '430', name: 'Podatki' },
  { number: '450', name: 'Różne wydatki' },
  { number: '458', name: 'Inne koszty' },
  { number: '201-1-1', name: 'Świadczenia na prowincję (uregulowane)' },
];

const FINANCIAL_STATUS_CATEGORIES = [
  { key: 'kasa_domu', name: '1. Kasa domu', accounts: ['100'] },
  { key: 'kasa_dewiz', name: '2. Kasa dewiz', accounts: ['101', '102', '103', '104', '105', '106', '107', '108'] },
  { key: 'bank', name: '3. Bank', accounts: ['110', '111', '112'] },
  { key: 'lokaty', name: '4. Lokaty bankowe', accounts: ['117', '118', '119'] },
  { key: 'bank_dewiz', name: '5. Bank dewizowy', accounts: ['113', '114', '115', '116'] },
];

const LIABILITY_CATEGORIES = [
  { name: '1. Pożyczki udzielone', accounts: ['212', '213'] },
  { name: '2. Pożyczki zaciągnięte', accounts: ['215'] },
  { name: '3. Sumy przechodnie', accounts: ['149', '150'] },
  { name: '4. Rozliczenia z prowincją', accounts: ['200', '201'] },
  { name: '5. Rozliczenia z innymi', accounts: ['202', '208'] },
];

export const ExportToExcelFull: React.FC<ExportToExcelFullProps> = ({
  report,
  locationName
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const getMonthName = (m: number) => {
    const months = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    return months[m - 1] || '';
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { month, year, location_id } = report;

      // Fetch location details
      const { data: locationData } = await supabase
        .from('locations')
        .select('*')
        .eq('id', location_id)
        .single();

      // Calculate date range
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

      // Fetch transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          *,
          debit_account:accounts!transactions_debit_account_id_fkey(id, number, name),
          credit_account:accounts!transactions_credit_account_id_fkey(id, number, name)
        `)
        .eq('location_id', location_id)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      // Fetch report details
      const { data: reportDetails } = await supabase
        .from('report_details')
        .select('*')
        .eq('report_id', report.id)
        .single();

      // Process transactions into account totals
      const incomeMap = new Map<string, number>();
      const expenseMap = new Map<string, number>();
      const financialStatusMap = new Map<string, { income: number; expense: number }>();

      transactions?.forEach(tx => {
        // Income - credit side
        if (tx.credit_account) {
          const accNum = tx.credit_account.number;
          const prefix = accNum.split('-')[0];
          const amount = tx.credit_amount || tx.amount || 0;
          
          if (prefix.startsWith('7') || prefix.startsWith('2')) {
            incomeMap.set(prefix, (incomeMap.get(prefix) || 0) + amount);
          }

          if (prefix.startsWith('1')) {
            const existing = financialStatusMap.get(prefix) || { income: 0, expense: 0 };
            existing.income += amount;
            financialStatusMap.set(prefix, existing);
          }
        }

        // Expenses - debit side
        if (tx.debit_account) {
          const accNum = tx.debit_account.number;
          const prefix = accNum.split('-')[0];
          const amount = tx.debit_amount || tx.amount || 0;
          
          if (prefix.startsWith('4') || prefix.startsWith('2')) {
            expenseMap.set(prefix, (expenseMap.get(prefix) || 0) + amount);
          }

          if (prefix.startsWith('1')) {
            const existing = financialStatusMap.get(prefix) || { income: 0, expense: 0 };
            existing.expense += amount;
            financialStatusMap.set(prefix, existing);
          }
        }
      });

      // Create workbook
      const wb = XLSX.utils.book_new();

      // ========== SHEET 1: PRZYCHODY ==========
      const sheet1Data: (string | number | null)[][] = [];
      
      // Header
      sheet1Data.push([locationData?.name || locationName]);
      sheet1Data.push([`${locationData?.postal_code || ''} ${locationData?.city || ''}`]);
      sheet1Data.push([locationData?.address || '']);
      sheet1Data.push(['']);
      sheet1Data.push([`SPRAWOZDANIE MIESIĘCZNE ZA OKRES: ${getMonthName(month).toUpperCase()} ${year} r.`]);
      sheet1Data.push(['']);
      sheet1Data.push(['I. PRZYCHODY']);
      sheet1Data.push(['']);
      sheet1Data.push(['Nr. konta', 'Treść', 'kwota']);

      // Income rows
      let totalIncome = 0;
      INCOME_ACCOUNTS.forEach(acc => {
        const amount = incomeMap.get(acc.number) || 0;
        totalIncome += amount;
        sheet1Data.push([acc.number, acc.name, amount]);
      });

      sheet1Data.push(['']);
      sheet1Data.push(['', 'PRZYCHODY RAZEM:', totalIncome]);
      sheet1Data.push(['']);
      sheet1Data.push(['']);
      sheet1Data.push([`Przyjęto na radzie domowej dnia ................${year} r.`]);
      sheet1Data.push(['']);
      sheet1Data.push(['SUPERIOR', 'EKONOM', 'PROBOSZCZ', 'I Radny', 'II Radny']);
      sheet1Data.push(['']);
      sheet1Data.push(['']);
      sheet1Data.push([`Prowincja Misjonarzy Oblatów M.N. PEKAO S.A. ${locationData?.bank_account || ''}`]);

      const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      sheet1['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, sheet1, 'Przychody');

      // ========== SHEET 2: ROZCHODY I PODSUMOWANIA ==========
      const sheet2Data: (string | number | null)[][] = [];
      
      sheet2Data.push(['II. ROZCHODY']);
      sheet2Data.push(['']);
      sheet2Data.push(['Nr. konta', 'Treść', 'kwota']);

      // Expense rows
      let totalExpense = 0;
      EXPENSE_ACCOUNTS.forEach(acc => {
        const amount = expenseMap.get(acc.number) || 0;
        totalExpense += amount;
        sheet2Data.push([acc.number, acc.name, amount]);
      });

      sheet2Data.push(['']);
      sheet2Data.push(['', 'ROZCHODY RAZEM:', totalExpense]);
      sheet2Data.push(['']);
      sheet2Data.push(['']);

      // A. Stan finansowy domu
      sheet2Data.push(['A. Stan finansowy domu']);
      sheet2Data.push(['', 'Początek miesiąca', 'Przychody', 'Rozchody', 'Koniec miesiąca']);

      let totalOpening = 0;
      let totalFsIncome = 0;
      let totalFsExpense = 0;
      let totalClosing = 0;

      FINANCIAL_STATUS_CATEGORIES.forEach(category => {
        let categoryIncome = 0;
        let categoryExpense = 0;
        category.accounts.forEach(acc => {
          const data = financialStatusMap.get(acc);
          if (data) {
            categoryIncome += data.income;
            categoryExpense += data.expense;
          }
        });
        const opening = 0; // Would need historical data
        const closing = opening + categoryIncome - categoryExpense;
        
        totalOpening += opening;
        totalFsIncome += categoryIncome;
        totalFsExpense += categoryExpense;
        totalClosing += closing;

        sheet2Data.push([category.name, opening, categoryIncome, categoryExpense, closing]);
      });

      sheet2Data.push(['SALDO', totalOpening, totalFsIncome, totalFsExpense, totalClosing]);
      sheet2Data.push(['']);
      sheet2Data.push(['']);

      // B. Intencje
      sheet2Data.push(['B. Intencje']);
      sheet2Data.push(['', 'Początek miesiąca', 'Odprawione i oddane', 'Przyjęte', 'Stan końcowy']);
      const intentions210Income = incomeMap.get('210') || 0;
      const intentions210Expense = expenseMap.get('210') || 0;
      const intentionsOpening = 0;
      const intentionsClosing = intentionsOpening - intentions210Expense + intentions210Income;
      sheet2Data.push(['1. Intencje', intentionsOpening, intentions210Expense, intentions210Income, intentionsClosing]);
      sheet2Data.push(['']);
      sheet2Data.push(['']);

      // D. Należności i zobowiązania (skip C - Towary)
      sheet2Data.push(['D. Należności i zobowiązania']);
      sheet2Data.push(['', 'należności (pocz.)', 'zobowiązania (pocz.)', 'należności (zm.)', 'zobowiązania (zm.)', 'należności (kon.)', 'zobowiązania (kon.)']);
      LIABILITY_CATEGORIES.forEach(category => {
        sheet2Data.push([category.name, 0, 0, 0, 0, 0, 0]);
      });

      const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Data);
      sheet2['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, sheet2, 'Rozchody');

      // Generate filename
      const monthNames = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paz', 'lis', 'gru'];
      const filename = `sprawozdanie_${locationName.replace(/\s+/g, '_')}_${monthNames[month - 1]}_${year}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success('Raport wyeksportowany do Excel zgodnie ze wzorem');
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
      Eksport do Excel (pełny)
    </Button>
  );
};

export default ExportToExcelFull;
