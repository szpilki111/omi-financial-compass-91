
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

interface AccountBreakdown {
  account_number: string;
  account_name: string;
  account_type: string;
  total_amount: number;
  category: 'income' | 'expense' | 'other';
  side: 'debit' | 'credit';
}

interface ReportPDFGeneratorProps {
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

const ReportPDFGenerator: React.FC<ReportPDFGeneratorProps> = ({
  report,
  financialDetails,
  isGenerating,
  onGenerateStart,
  onGenerateEnd
}) => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Pobieranie szczegółowej rozpiski kont dla PDF
  const { data: accountsBreakdown } = useQuery({
    queryKey: ['report_accounts_breakdown_pdf', report.id, report.location_id, report.month, report.year],
    queryFn: async () => {
      // Oblicz daty na podstawie miesiąca i roku
      const firstDayOfMonth = new Date(report.year, report.month - 1, 1);
      const lastDayOfMonth = new Date(report.year, report.month, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

      // Pobierz wszystkie transakcje dla danej lokalizacji w okresie
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          debit_account_id,
          credit_account_id,
          debit_amount,
          credit_amount,
          description,
          document_number,
          debit_account:accounts!debit_account_id(number, name, type),
          credit_account:accounts!credit_account_id(number, name, type)
        `)
        .eq('location_id', report.location_id)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;

      // Funkcja do sprawdzania czy konto należy do kategorii przychodów/kosztów
      const isRelevantAccount = (accountNumber: string) => {
        if (!accountNumber) return false;
        return accountNumber.startsWith('2') || accountNumber.startsWith('4') || accountNumber.startsWith('7');
      };

      // Funkcja do kategoryzacji kont
      const categorizeAccount = (accountNumber: string, side: 'debit' | 'credit'): 'income' | 'expense' | 'other' => {
        if (!accountNumber) return 'other';
        
        if ((accountNumber.startsWith('7') && side === 'credit') || (accountNumber.startsWith('2') && side === 'credit')) {
          return 'income';
        }
        
        if ((accountNumber.startsWith('4') && side === 'debit') || (accountNumber.startsWith('2') && side === 'debit')) {
          return 'expense';
        }
        
        return 'other';
      };

      // Zgrupuj transakcje według kont i oblicz sumy
      const accountTotals = new Map<string, AccountBreakdown>();

      transactions?.forEach(transaction => {
        const { amount, debit_account, credit_account, debit_amount, credit_amount } = transaction;

        // Dla konta debetowego
        if (debit_account && isRelevantAccount(debit_account.number)) {
          const key = `${debit_account.number}_debit`;
          const existing = accountTotals.get(key);
          const transactionAmount = debit_amount && debit_amount > 0 ? debit_amount : Number(amount);
          
          if (existing) {
            existing.total_amount += transactionAmount;
          } else {
            accountTotals.set(key, {
              account_number: debit_account.number,
              account_name: debit_account.name,
              account_type: debit_account.type,
              total_amount: transactionAmount,
              category: categorizeAccount(debit_account.number, 'debit'),
              side: 'debit'
            });
          }
        }

        // Dla konta kredytowego
        if (credit_account && isRelevantAccount(credit_account.number)) {
          const key = `${credit_account.number}_credit`;
          const existing = accountTotals.get(key);
          const transactionAmount = credit_amount && credit_amount > 0 ? credit_amount : Number(amount);
          
          if (existing) {
            existing.total_amount += transactionAmount;
          } else {
            accountTotals.set(key, {
              account_number: credit_account.number,
              account_name: credit_account.name,
              account_type: credit_account.type,
              total_amount: transactionAmount,
              category: categorizeAccount(credit_account.number, 'credit'),
              side: 'credit'
            });
          }
        }
      });

      // Konwertuj mapę na tablicę i posortuj
      const breakdown = Array.from(accountTotals.values())
        .filter(account => account.category === 'income' || account.category === 'expense')
        .filter(account => Math.abs(account.total_amount) > 0.01)
        .sort((a, b) => a.account_number.localeCompare(b.account_number));

      return breakdown;
    },
    enabled: !!report
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Roboczy';
      case 'submitted':
        return 'Złożony';
      case 'approved':
        return 'Zatwierdzony';
      case 'to_be_corrected':
        return 'Do poprawy';
      default:
        return status;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'income':
        return 'Przychody (konta 7xx i 2xx po stronie MA)';
      case 'expense':
        return 'Koszty (konta 4xx i 2xx po stronie WN)';
      default:
        return 'Pozostałe';
    }
  };

  const generatePDF = async () => {
    if (!printRef.current) return;

    onGenerateStart();

    try {
      // Utwórz tymczasowy element do renderowania PDF
      const element = printRef.current;
      
      // Opcje dla html2canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Utwórz PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Dodaj pierwszą stronę
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Dodaj kolejne strony jeśli potrzeba
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Zapisz PDF
      const fileName = `Raport_${report.location?.name || 'Nieznana'}_${report.period}.pdf`;
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

  // Grupowanie kont według kategorii dla PDF
  const groupedAccounts = accountsBreakdown?.reduce((groups, account) => {
    const category = account.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(account);
    return groups;
  }, {} as Record<string, AccountBreakdown[]>);

  const getCategoryTotal = (accounts: AccountBreakdown[]) => {
    return accounts.reduce((sum, account) => sum + account.total_amount, 0);
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={generatePDF} 
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Spinner size="sm" className="mr-2" />
        ) : (
          <FileTextIcon className="mr-2 h-4 w-4" />
        )}
        {isGenerating ? 'Generowanie...' : 'Eksportuj do PDF'}
      </Button>

      {/* Ukryty element do renderowania PDF */}
      <div ref={printRef} className="fixed -left-[9999px] top-0 bg-white p-8 w-[210mm]">
        <div className="space-y-6">
          {/* Nagłówek raportu */}
          <div className="text-center border-b-2 border-gray-300 pb-4">
            <h1 className="text-2xl font-bold text-gray-800">RAPORT FINANSOWY</h1>
            <h2 className="text-xl font-semibold text-gray-700 mt-2">{report.title}</h2>
            <p className="text-gray-600 mt-1">
              Status: {getStatusLabel(report.status)}
            </p>
          </div>

          {/* Informacje podstawowe */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Informacje podstawowe</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Placówka:</strong> {report.location?.name || 'Nieznana placówka'}</p>
                <p><strong>Okres:</strong> {report.period}</p>
                <p><strong>Data utworzenia:</strong> {new Date(report.created_at).toLocaleDateString('pl-PL')}</p>
              </div>
            </div>

            {report.status !== 'draft' && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Status raportu</h3>
                <div className="space-y-1 text-sm">
                  {report.submitted_at && (
                    <p><strong>Data złożenia:</strong> {new Date(report.submitted_at).toLocaleDateString('pl-PL')}</p>
                  )}
                  {report.submitted_by_profile?.name && (
                    <p><strong>Złożony przez:</strong> {report.submitted_by_profile.name}</p>
                  )}
                  {report.reviewed_at && (
                    <p><strong>Data weryfikacji:</strong> {new Date(report.reviewed_at).toLocaleDateString('pl-PL')}</p>
                  )}
                  {report.reviewed_by_profile?.name && (
                    <p><strong>Zweryfikowany przez:</strong> {report.reviewed_by_profile.name}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Komentarze (jeśli istnieją) */}
          {report.comments && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Komentarze</h3>
              <div className="bg-gray-100 p-3 rounded text-sm">
                {report.comments}
              </div>
            </div>
          )}

          {/* Podsumowanie finansowe */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Podsumowanie finansowe</h3>
            <div className="bg-gray-50 p-4 rounded">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Saldo otwarcia:</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(financialDetails.openingBalance)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Przychody:</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(financialDetails.income)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Koszty:</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(financialDetails.expense)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Saldo końcowe:</p>
                  <p className="text-lg font-bold text-gray-800">
                    {formatCurrency(financialDetails.balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Szczegółowa rozpiska kont */}
          {accountsBreakdown && accountsBreakdown.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Szczegółowa rozpiska kont</h3>
              <p className="text-xs text-gray-600 mb-4">
                Pokazuje tylko konta wpływające na wynik finansowy (200, 400, 700)
              </p>
              
              {Object.entries(groupedAccounts || {}).map(([category, accounts]) => (
                <div key={category} className="mb-6">
                  <div className="flex justify-between items-center mb-3 bg-gray-100 p-2 rounded">
                    <h4 className="text-md font-semibold">{getCategoryTitle(category)}</h4>
                    <div className="text-md font-bold">
                      {formatCurrency(getCategoryTotal(accounts))}
                    </div>
                  </div>
                  
                  <table className="w-full text-xs border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 p-2 text-left">Numer konta</th>
                        <th className="border border-gray-300 p-2 text-left">Nazwa konta</th>
                        <th className="border border-gray-300 p-2 text-center">Strona</th>
                        <th className="border border-gray-300 p-2 text-right">Kwota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, index) => (
                        <tr key={`${account.account_number}_${account.side}_${index}`}>
                          <td className="border border-gray-300 p-2 font-medium">
                            {account.account_number}
                          </td>
                          <td className="border border-gray-300 p-2">
                            {account.account_name}
                          </td>
                          <td className="border border-gray-300 p-2 text-center">
                            <span className={`text-xs px-2 py-1 rounded ${
                              account.side === 'debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {account.side === 'debit' ? 'WN' : 'MA'}
                            </span>
                          </td>
                          <td className="border border-gray-300 p-2 text-right font-medium">
                            {formatCurrency(account.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              
              <div className="border-t-2 border-gray-400 pt-2 mt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold">Suma kontrolna:</span>
                  <span className="font-bold">
                    {formatCurrency(accountsBreakdown.reduce((sum, account) => sum + account.total_amount, 0))}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  * Suma kontrolna reprezentuje różnicę między obrotami Ma i Wn
                </p>
              </div>
            </div>
          )}

          {/* Stopka */}
          <div className="border-t-2 border-gray-300 pt-4 text-center text-xs text-gray-500">
            <p>Raport wygenerowany automatycznie w dniu {new Date().toLocaleDateString('pl-PL')}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportPDFGenerator;
