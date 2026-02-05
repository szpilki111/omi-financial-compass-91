 import React, { useRef } from 'react';
 import { getFirstDayOfMonth, getLastDayOfMonth } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { FileTextIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Report } from '@/types/reports';
import { Spinner } from '@/components/ui/Spinner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SyntheticAccount {
  prefix: string;
  name: string;
  total: number;
}

interface ReportPDFGeneratorCompactProps {
  report: Report;
  financialDetails: {
    income: number;
    expense: number;
    balance: number;
    settlements: number;
    openingBalance: number;
  };
  isGenerating: boolean;
  onGenerateStart: () => void;
  onGenerateEnd: () => void;
}

// Nowa struktura kategorii stanu finansowego
const FINANCIAL_STATUS_CATEGORIES = [
  { key: 'kasa_domu', name: '1. Kasa domu', accounts: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109'] },
  { key: 'bank', name: '2. Bank', accounts: ['110', '111', '112', '113', '114', '115', '116'] },
  { key: 'lokaty', name: '3. Lokaty bankowe', accounts: ['117'] },
];

// Nowa struktura kategorii należności/zobowiązań
const LIABILITY_CATEGORIES = [
  { name: '1. Pożyczki udzielone', accounts: ['212', '213'] },
  { name: '2. Pożyczki zaciągnięte', accounts: ['215'] },
  { name: '3. Rozliczenia z prowincją', accounts: ['201'] },
  { name: '4. Rozliczenia z innymi', accounts: ['217'] },
];

const ReportPDFGeneratorCompact: React.FC<ReportPDFGeneratorCompactProps> = ({
  report,
  financialDetails,
  isGenerating,
  onGenerateStart,
  onGenerateEnd
}) => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Pobieranie danych transakcji
  const { data: reportData } = useQuery({
    queryKey: ['pdf_report_data', report.id, report.location_id, report.month, report.year],
    queryFn: async () => {
      const dateFrom = getFirstDayOfMonth(report.year, report.month);
      const dateTo = getLastDayOfMonth(report.year, report.month);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          debit_account_id,
          credit_account_id,
          debit_amount,
          credit_amount,
          debit_account:accounts!debit_account_id(number, name, type),
          credit_account:accounts!credit_account_id(number, name, type)
        `)
        .eq('location_id', report.location_id)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      // Process transactions
      const financialStatusMap = new Map<string, { debits: number; credits: number }>();
      const liabilitiesMap = new Map<string, { receivables: number; liabilities: number }>();
      const incomeAccounts: SyntheticAccount[] = [];
      const expenseAccounts: SyntheticAccount[] = [];
      const incomeMap = new Map<string, { name: string; total: number }>();
      const expenseMap = new Map<string, { name: string; total: number }>();
      let intentions210Received = 0;
      let intentions210CelebratedGiven = 0;
      
      transactions?.forEach(transaction => {
        const { debit_account, credit_account, debit_amount, credit_amount, amount } = transaction;
        
        // Debit side
        if (debit_account) {
          const prefix = debit_account.number.split('-')[0];
          const transactionAmount = debit_amount && debit_amount > 0 ? debit_amount : Number(amount);
          
          // Financial status for 1xx (Wn = Uznania)
          if (prefix.startsWith('1')) {
            const existing = financialStatusMap.get(prefix) || { debits: 0, credits: 0 };
            existing.debits += transactionAmount;
            financialStatusMap.set(prefix, existing);
          }
          
          // Liabilities for 2xx (Wn = Należności)
          if (prefix.startsWith('2')) {
            const existing = liabilitiesMap.get(prefix) || { receivables: 0, liabilities: 0 };
            existing.receivables += transactionAmount;
            liabilitiesMap.set(prefix, existing);
          }

          // Intentions 210 (Wn = przyjęte)
          if (prefix === '210') {
            intentions210Received += transactionAmount;
          }
          
          // Expenses (only 4xx)
          if (prefix.startsWith('4')) {
            const existing = expenseMap.get(prefix);
            if (existing) {
              existing.total += transactionAmount;
            } else {
              expenseMap.set(prefix, { name: debit_account.name.split('-')[0].trim(), total: transactionAmount });
            }
          }
        }
        
        // Credit side
        if (credit_account) {
          const prefix = credit_account.number.split('-')[0];
          const transactionAmount = credit_amount && credit_amount > 0 ? credit_amount : Number(amount);
          
          // Financial status for 1xx (Ma = Obciążenia)
          if (prefix.startsWith('1')) {
            const existing = financialStatusMap.get(prefix) || { debits: 0, credits: 0 };
            existing.credits += transactionAmount;
            financialStatusMap.set(prefix, existing);
          }

          // Liabilities for 2xx (Ma = Zobowiązania)
          if (prefix.startsWith('2')) {
            const existing = liabilitiesMap.get(prefix) || { receivables: 0, liabilities: 0 };
            existing.liabilities += transactionAmount;
            liabilitiesMap.set(prefix, existing);
          }

          // Intentions 210 (Ma = odprawione i oddane)
          if (prefix === '210') {
            intentions210CelebratedGiven += transactionAmount;
          }
          
          // Income (only 7xx)
          if (prefix.startsWith('7')) {
            const existing = incomeMap.get(prefix);
            if (existing) {
              existing.total += transactionAmount;
            } else {
              incomeMap.set(prefix, { name: credit_account.name.split('-')[0].trim(), total: transactionAmount });
            }
          }
        }
      });

      // Convert maps to arrays
      incomeMap.forEach((value, key) => {
        if (Math.abs(value.total) >= 0.01) {
          incomeAccounts.push({ prefix: key, name: value.name, total: value.total });
        }
      });
      expenseMap.forEach((value, key) => {
        if (Math.abs(value.total) >= 0.01) {
          expenseAccounts.push({ prefix: key, name: value.name, total: value.total });
        }
      });

      // Build financial status data
      const financialStatusData = FINANCIAL_STATUS_CATEGORIES.map(category => {
        let debits = 0;
        let credits = 0;
        category.accounts.forEach(acc => {
          const data = financialStatusMap.get(acc);
          if (data) {
            debits += data.debits;
            credits += data.credits;
          }
        });
        const opening = 0;
        const closing = opening + debits - credits;
        return { name: category.name, opening, debits, credits, closing };
      });

      // Build liabilities data
      const liabilitiesData = LIABILITY_CATEGORIES.map(category => {
        let receivables = 0;
        let liabilities = 0;
        category.accounts.forEach(acc => {
          const data = liabilitiesMap.get(acc);
          if (data) {
            receivables += data.receivables;
            liabilities += data.liabilities;
          }
        });
        const opening = 0;
        const closing = opening + receivables - liabilities;
        return { name: category.name, opening, receivables, liabilities, closing };
      });

      return {
        financialStatus: financialStatusData,
        liabilities: liabilitiesData,
        intentions: {
          opening: 0,
          celebratedGiven: intentions210CelebratedGiven,
          received: intentions210Received,
          closing: 0 + intentions210Received - intentions210CelebratedGiven
        },
        income: incomeAccounts.sort((a, b) => a.prefix.localeCompare(b.prefix)),
        expenses: expenseAccounts.sort((a, b) => a.prefix.localeCompare(b.prefix)),
      };
    },
    enabled: !!report
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  const getMonthName = (month: number) => {
    const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    return months[month - 1];
  };

  const sumAccounts = (accounts: SyntheticAccount[]) => 
    accounts.reduce((sum, acc) => sum + acc.total, 0);

  const generatePDF = async () => {
    if (!printRef.current) return;

    onGenerateStart();

    try {
      const element = printRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `Raport_${report.location?.name || 'Nieznana'}_${getMonthName(report.month)}_${report.year}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF wygenerowany",
        description: `Raport został zapisany jako ${fileName}`,
      });
    } catch (error) {
      console.error('Błąd podczas generowania PDF:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas generowania PDF.",
        variant: "destructive",
      });
    } finally {
      onGenerateEnd();
    }
  };

  const renderAccountTable = (accounts: SyntheticAccount[], showTotal = true) => {
    if (accounts.length === 0) return null;
    
    return (
      <table className="w-full text-[10px] border-collapse mb-2">
        <tbody>
          {accounts.map((account) => (
            <tr key={account.prefix} className="border-b border-gray-200">
              <td className="py-0.5 px-1 w-12 font-medium">{account.prefix}</td>
              <td className="py-0.5 px-1">{account.name}</td>
              <td className="py-0.5 px-1 text-right w-24 font-medium">
                {formatCurrency(account.total)}
              </td>
            </tr>
          ))}
          {showTotal && accounts.length > 1 && (
            <tr className="border-t-2 border-gray-400 font-bold">
              <td colSpan={2} className="py-0.5 px-1 text-right">RAZEM:</td>
              <td className="py-0.5 px-1 text-right">{formatCurrency(sumAccounts(accounts))}</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={generatePDF} 
        disabled={isGenerating}
        className="gap-2"
      >
        {isGenerating ? (
          <Spinner size="sm" />
        ) : (
          <FileTextIcon className="h-4 w-4" />
        )}
        {isGenerating ? 'Generowanie...' : 'PDF (2 strony)'}
      </Button>

      {/* Ukryty element do renderowania PDF - max 2 strony */}
      <div ref={printRef} className="fixed -left-[9999px] top-0 bg-white w-[210mm]" style={{ fontSize: '10px' }}>
        {/* ===== STRONA 1: STAN FINANSOWY, INTENCJE, NALEŻNOŚCI, PODPISY ===== */}
        <div className="p-6" style={{ minHeight: '277mm', pageBreakAfter: 'always' }}>
          {/* Nagłówek - kompaktowy */}
          <div className="text-center border-b border-gray-400 pb-2 mb-4">
            <h1 className="text-lg font-bold">SPRAWOZDANIE MIESIĘCZNE</h1>
            <p className="text-sm">{report.location?.name} | {getMonthName(report.month)} {report.year}</p>
          </div>

          {/* A. Stan finansowy domu */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">A. Stan finansowy domu</h2>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-0.5 px-1 text-left"></th>
                  <th className="py-0.5 px-1 text-right w-20">Początek</th>
                  <th className="py-0.5 px-1 text-right w-20">Uznania</th>
                  <th className="py-0.5 px-1 text-right w-20">Obciążenia</th>
                  <th className="py-0.5 px-1 text-right w-20">Koniec</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.financialStatus.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-0.5 px-1">{row.name}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.opening)}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.debits)}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.credits)}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.closing)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold">
                  <td className="py-0.5 px-1">SALDO</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.financialStatus.reduce((s, r) => s + r.opening, 0) || 0)}</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.financialStatus.reduce((s, r) => s + r.debits, 0) || 0)}</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.financialStatus.reduce((s, r) => s + r.credits, 0) || 0)}</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.financialStatus.reduce((s, r) => s + r.closing, 0) || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* B. Intencje */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">B. Intencje</h2>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-0.5 px-1 text-left"></th>
                  <th className="py-0.5 px-1 text-right w-20">Początek</th>
                  <th className="py-0.5 px-1 text-right w-24">Odpr. i oddane</th>
                  <th className="py-0.5 px-1 text-right w-20">Przyjęte</th>
                  <th className="py-0.5 px-1 text-right w-20">Koniec</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 px-1">1. Intencje</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.intentions.opening || 0)}</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.intentions.celebratedGiven || 0)}</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.intentions.received || 0)}</td>
                  <td className="py-0.5 px-1 text-right">{formatCurrency(reportData?.intentions.closing || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* C. Należności i zobowiązania */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">C. Należności i zobowiązania</h2>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-0.5 px-1 text-left"></th>
                  <th className="py-0.5 px-1 text-right w-20">Początek</th>
                  <th className="py-0.5 px-1 text-right w-20">Należności</th>
                  <th className="py-0.5 px-1 text-right w-20">Zobowiązania</th>
                  <th className="py-0.5 px-1 text-right w-20">Koniec</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.liabilities.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-0.5 px-1">{row.name}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.opening)}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.receivables)}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.liabilities)}</td>
                    <td className="py-0.5 px-1 text-right">{formatCurrency(row.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PODPISY */}
          <div className="mt-8">
            <h2 className="text-sm font-bold mb-4">PODPISY:</h2>
            <div className="grid grid-cols-5 gap-4">
              <div className="border-b border-gray-400 pb-8 text-center">
                <p className="text-[9px] text-gray-600 mt-2">Superior</p>
              </div>
              <div className="border-b border-gray-400 pb-8 text-center">
                <p className="text-[9px] text-gray-600 mt-2">Ekonom</p>
              </div>
              <div className="border-b border-gray-400 pb-8 text-center">
                <p className="text-[9px] text-gray-600 mt-2">Proboszcz</p>
              </div>
              <div className="border-b border-gray-400 pb-8 text-center">
                <p className="text-[9px] text-gray-600 mt-2">I Radny</p>
              </div>
              <div className="border-b border-gray-400 pb-8 text-center">
                <p className="text-[9px] text-gray-600 mt-2">II Radny</p>
              </div>
            </div>
          </div>

          {/* Data wydruku strony 1 */}
          <div className="text-center text-[8px] text-gray-400 mt-4">
            Strona 1/2 | Wydrukowano: {new Date().toLocaleDateString('pl-PL')}
          </div>
        </div>

        {/* ===== STRONA 2: PRZYCHODY I ROZCHODY (tylko 7xx i 4xx) ===== */}
        <div className="p-6" style={{ minHeight: '277mm' }}>
          {/* Nagłówek strony 2 */}
          <div className="text-center border-b border-gray-400 pb-2 mb-4">
            <h1 className="text-lg font-bold">PRZYCHODY I ROZCHODY</h1>
            <p className="text-sm">{report.location?.name} | {getMonthName(report.month)} {report.year}</p>
          </div>

          {/* I. PRZYCHODY (tylko 7xx) */}
          <div className="mb-6">
            <h2 className="text-sm font-bold bg-green-100 p-1 mb-1">I. PRZYCHODY (konta 7xx)</h2>
            {reportData?.income && reportData.income.length > 0 ? (
              renderAccountTable(reportData.income)
            ) : (
              <p className="text-[10px] text-gray-500 italic">Brak przychodów w tym okresie</p>
            )}
          </div>

          {/* II. ROZCHODY (tylko 4xx) */}
          <div className="mb-6">
            <h2 className="text-sm font-bold bg-red-100 p-1 mb-1">II. ROZCHODY (konta 4xx)</h2>
            {reportData?.expenses && reportData.expenses.length > 0 ? (
              renderAccountTable(reportData.expenses)
            ) : (
              <p className="text-[10px] text-gray-500 italic">Brak rozchodów w tym okresie</p>
            )}
          </div>

          {/* WYNIK FINANSOWY */}
          <div className="p-3 bg-gray-100 border-2 border-gray-400">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">WYNIK FINANSOWY (Przychody - Rozchody):</span>
              <span className={`font-bold text-lg ${
                (sumAccounts(reportData?.income || []) - sumAccounts(reportData?.expenses || [])) >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatCurrency(sumAccounts(reportData?.income || []) - sumAccounts(reportData?.expenses || []))}
              </span>
            </div>
          </div>

          {/* Stopka strony 2 */}
          <div className="text-center text-[8px] text-gray-400 mt-8">
            Strona 2/2 | Raport wygenerowany automatycznie | {new Date().toLocaleDateString('pl-PL')}
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportPDFGeneratorCompact;
