
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FileTextIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Report } from '@/types/reports';
import { Spinner } from '@/components/ui/Spinner';

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
