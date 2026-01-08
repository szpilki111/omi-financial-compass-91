import React, { useRef } from 'react';
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

const ReportPDFGeneratorCompact: React.FC<ReportPDFGeneratorCompactProps> = ({
  report,
  financialDetails,
  isGenerating,
  onGenerateStart,
  onGenerateEnd
}) => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Pobieranie danych stanu kasowego (aktywa, pasywa, rozrachunki)
  const { data: cashFlowData } = useQuery({
    queryKey: ['cash_flow_compact_pdf', report.id, report.location_id, report.month, report.year],
    queryFn: async () => {
      const firstDayOfMonth = new Date(report.year, report.month - 1, 1);
      const lastDayOfMonth = new Date(report.year, report.month, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

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

      // Oblicz salda kont
      const accountBalances = new Map<string, { balance: number, name: string }>();
      
      transactions?.forEach(transaction => {
        const { debit_account, credit_account, debit_amount, credit_amount, amount } = transaction;
        
        if (debit_account) {
          const key = debit_account.number.split('-')[0]; // prefix syntetyczny
          const transactionAmount = debit_amount && debit_amount > 0 ? debit_amount : Number(amount);
          
          if (accountBalances.has(key)) {
            accountBalances.get(key)!.balance += transactionAmount;
          } else {
            accountBalances.set(key, { balance: transactionAmount, name: debit_account.name.split('-')[0].trim() });
          }
        }
        
        if (credit_account) {
          const key = credit_account.number.split('-')[0];
          const transactionAmount = credit_amount && credit_amount > 0 ? credit_amount : Number(amount);
          
          if (accountBalances.has(key)) {
            accountBalances.get(key)!.balance -= transactionAmount;
          } else {
            accountBalances.set(key, { balance: -transactionAmount, name: credit_account.name.split('-')[0].trim() });
          }
        }
      });

      // Grupuj według kategorii
      const assets: SyntheticAccount[] = [];
      const liabilities: SyntheticAccount[] = [];
      const provinceSettlements: SyntheticAccount[] = [];
      const intentions: SyntheticAccount[] = [];
      const income: SyntheticAccount[] = [];
      const expenses: SyntheticAccount[] = [];

      accountBalances.forEach(({ balance, name }, prefix) => {
        if (Math.abs(balance) < 0.01) return;
        
        const account = { prefix, name, total: balance };
        
        // Aktywa: 100-199
        if (prefix.startsWith('1')) {
          assets.push(account);
        }
        // Rozrachunki z prowincją: 200, 201, 202
        else if (['200', '201', '202'].includes(prefix)) {
          provinceSettlements.push(account);
        }
        // Intencje: 210, 701
        else if (['210'].includes(prefix)) {
          intentions.push(account);
        }
        // Pasywa/Zobowiązania: 2xx
        else if (prefix.startsWith('2')) {
          liabilities.push(account);
        }
        // Przychody: 7xx
        else if (prefix.startsWith('7')) {
          income.push(account);
        }
        // Koszty: 4xx
        else if (prefix.startsWith('4')) {
          expenses.push(account);
        }
      });

      return {
        assets: assets.sort((a, b) => a.prefix.localeCompare(b.prefix)),
        liabilities: liabilities.sort((a, b) => a.prefix.localeCompare(b.prefix)),
        provinceSettlements: provinceSettlements.sort((a, b) => a.prefix.localeCompare(b.prefix)),
        intentions: intentions.sort((a, b) => a.prefix.localeCompare(b.prefix)),
        income: income.sort((a, b) => a.prefix.localeCompare(b.prefix)),
        expenses: expenses.sort((a, b) => a.prefix.localeCompare(b.prefix)),
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
        {/* ===== STRONA 1: AKTYWA, PASYWA, ROZRACHUNKI, PODPISY ===== */}
        <div className="p-6" style={{ minHeight: '277mm', pageBreakAfter: 'always' }}>
          {/* Nagłówek - kompaktowy */}
          <div className="text-center border-b border-gray-400 pb-2 mb-4">
            <h1 className="text-lg font-bold">RAPORT FINANSOWY</h1>
            <p className="text-sm">{report.location?.name} | {getMonthName(report.month)} {report.year}</p>
          </div>

          {/* A. AKTYWA */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">A. AKTYWA (STAN FINANSOWY DOMU)</h2>
            {cashFlowData?.assets && renderAccountTable(cashFlowData.assets)}
          </div>

          {/* B. PASYWA / ZOBOWIĄZANIA */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">B. PASYWA / ZOBOWIĄZANIA</h2>
            {cashFlowData?.liabilities && renderAccountTable(cashFlowData.liabilities)}
          </div>

          {/* C. ROZRACHUNKI Z PROWINCJĄ */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">C. ROZRACHUNKI Z PROWINCJĄ</h2>
            {cashFlowData?.provinceSettlements && renderAccountTable(cashFlowData.provinceSettlements)}
            {(!cashFlowData?.provinceSettlements || cashFlowData.provinceSettlements.length === 0) && (
              <p className="text-[10px] text-gray-500 italic">Brak rozrachunków</p>
            )}
          </div>

          {/* D. INTENCJE */}
          <div className="mb-4">
            <h2 className="text-sm font-bold bg-gray-100 p-1 mb-1">D. INTENCJE</h2>
            {cashFlowData?.intentions && renderAccountTable(cashFlowData.intentions, false)}
            {(!cashFlowData?.intentions || cashFlowData.intentions.length === 0) && (
              <p className="text-[10px] text-gray-500 italic">Brak intencji</p>
            )}
          </div>

          {/* PODSUMOWANIE FINANSOWE */}
          <div className="mb-6 p-2 bg-gray-50 border border-gray-300">
            <h2 className="text-sm font-bold mb-2">PODSUMOWANIE FINANSOWE</h2>
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div>
                <p className="text-gray-600">Saldo otwarcia:</p>
                <p className="font-bold">{formatCurrency(financialDetails.openingBalance)}</p>
              </div>
              <div>
                <p className="text-gray-600">Przychody:</p>
                <p className="font-bold text-green-700">{formatCurrency(financialDetails.income)}</p>
              </div>
              <div>
                <p className="text-gray-600">Koszty:</p>
                <p className="font-bold text-red-700">{formatCurrency(financialDetails.expense)}</p>
              </div>
              <div>
                <p className="text-gray-600">Saldo końcowe:</p>
                <p className="font-bold">{formatCurrency(financialDetails.balance)}</p>
              </div>
            </div>
          </div>

          {/* PODPISY */}
          <div className="mt-8">
            <h2 className="text-sm font-bold mb-4">PODPISY:</h2>
            <div className="grid grid-cols-2 gap-8">
              <div className="border-b border-gray-400 pb-8">
                <p className="text-[10px] text-gray-600 mt-2">Superior domu</p>
              </div>
              <div className="border-b border-gray-400 pb-8">
                <p className="text-[10px] text-gray-600 mt-2">Ekonom domu</p>
              </div>
              <div className="border-b border-gray-400 pb-8">
                <p className="text-[10px] text-gray-600 mt-2">Radny domowy</p>
              </div>
              <div className="border-b border-gray-400 pb-8">
                <p className="text-[10px] text-gray-600 mt-2">Radny domowy</p>
              </div>
            </div>
          </div>

          {/* Data wydruku strony 1 */}
          <div className="text-center text-[8px] text-gray-400 mt-4">
            Strona 1/2 | Wydrukowano: {new Date().toLocaleDateString('pl-PL')}
          </div>
        </div>

        {/* ===== STRONA 2: PRZYCHODY I KOSZTY (KONTA SYNTETYCZNE) ===== */}
        <div className="p-6" style={{ minHeight: '277mm' }}>
          {/* Nagłówek strony 2 */}
          <div className="text-center border-b border-gray-400 pb-2 mb-4">
            <h1 className="text-lg font-bold">PRZYCHODY I KOSZTY</h1>
            <p className="text-sm">{report.location?.name} | {getMonthName(report.month)} {report.year}</p>
          </div>

          {/* PRZYCHODY */}
          <div className="mb-6">
            <h2 className="text-sm font-bold bg-green-100 p-1 mb-1">PRZYCHODY (konta syntetyczne 7xx)</h2>
            {cashFlowData?.income && cashFlowData.income.length > 0 ? (
              renderAccountTable(cashFlowData.income)
            ) : (
              <p className="text-[10px] text-gray-500 italic">Brak przychodów w tym okresie</p>
            )}
          </div>

          {/* KOSZTY */}
          <div className="mb-6">
            <h2 className="text-sm font-bold bg-red-100 p-1 mb-1">KOSZTY (konta syntetyczne 4xx)</h2>
            {cashFlowData?.expenses && cashFlowData.expenses.length > 0 ? (
              renderAccountTable(cashFlowData.expenses)
            ) : (
              <p className="text-[10px] text-gray-500 italic">Brak kosztów w tym okresie</p>
            )}
          </div>

          {/* WYNIK FINANSOWY */}
          <div className="p-3 bg-gray-100 border-2 border-gray-400">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">WYNIK FINANSOWY (Przychody - Koszty):</span>
              <span className={`font-bold text-lg ${
                (financialDetails.income - financialDetails.expense) >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatCurrency(financialDetails.income - financialDetails.expense)}
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
