
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report, ReportSection, ReportEntry, SectionWithEntries } from '@/types/reports';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReportDetailsProps {
  reportId: string;
}

const ReportDetails: React.FC<ReportDetailsProps> = ({ reportId }) => {
  const [loading, setLoading] = useState(false);

  // Pobierz dane raportu
  const { data: report, isLoading: isLoadingReport } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();
        
      if (error) throw error;
      return data as Report;
    }
  });
  
  // Pobierz dane sekcji dla odpowiedniego typu raportu
  const { data: sections, isLoading: isLoadingSections } = useQuery({
    queryKey: ['report-sections', report?.report_type],
    queryFn: async () => {
      if (!report?.report_type) return [];
      
      const { data, error } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_type', report.report_type)
        .order('section_order', { ascending: true });
      
      if (error) throw error;
      return data as ReportSection[];
    },
    enabled: !!report?.report_type
  });
  
  // Pobierz dane wpisów raportu
  const { data: entries, isLoading: isLoadingEntries } = useQuery({
    queryKey: ['report-entries', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_entries')
        .select('*')
        .eq('report_id', reportId);
      
      if (error) throw error;
      return data as ReportEntry[];
    },
    enabled: !!reportId
  });
  
  // Grupujemy wpisy według sekcji
  const sectionsWithEntries: SectionWithEntries[] = React.useMemo(() => {
    if (!sections || !entries) return [];
    
    return sections.map(section => {
      const sectionEntries = entries.filter(entry => entry.section_id === section.id);
      return { section, entries: sectionEntries };
    });
  }, [sections, entries]);
  
  // Funkcja do eksportu raportu do Excel
  const exportToExcel = async () => {
    setLoading(true);
    try {
      // W przyszłości tutaj kod do eksportu do Excela
      alert('Eksport do Excel zostanie zaimplementowany w przyszłości.');
    } catch (error) {
      console.error('Błąd podczas eksportu:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funkcja do eksportu raportu do PDF
  const exportToPdf = async () => {
    setLoading(true);
    try {
      // W przyszłości tutaj kod do eksportu do PDF
      alert('Eksport do PDF zostanie zaimplementowany w przyszłości.');
    } catch (error) {
      console.error('Błąd podczas eksportu:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingReport || isLoadingSections || isLoadingEntries) {
    return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  }

  if (!report) {
    return <div className="text-red-600 p-4">Nie znaleziono raportu.</div>;
  }

  // Renderowanie dla różnych typów raportów
  const renderReportContent = () => {
    switch (report.report_type) {
      case 'zos':
        return renderZOSReport();
      case 'bilans':
        return renderBalanceSheet();
      case 'rzis':
        return renderIncomeStatement();
      case 'jpk':
        return renderJPKReport();
      case 'analiza':
        return renderAnalysisReport();
      default:
        return renderStandardReport();
    }
  };

  // Renderowanie raportu ZOS
  const renderZOSReport = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Zestawienie Obrotów i Sald (ZOS)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2}>Konto</TableHead>
                <TableHead rowSpan={2}>Nazwa</TableHead>
                <TableHead colSpan={2} className="text-center">Bilans otwarcia</TableHead>
                <TableHead colSpan={2} className="text-center">Obroty</TableHead>
                <TableHead colSpan={2} className="text-center">Saldo</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-right">Winien</TableHead>
                <TableHead className="text-right">Ma</TableHead>
                <TableHead className="text-right">Winien</TableHead>
                <TableHead className="text-right">Ma</TableHead>
                <TableHead className="text-right">Winien</TableHead>
                <TableHead className="text-right">Ma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionsWithEntries.map((swe) => (
                <React.Fragment key={swe.section.id}>
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={8} className="font-medium">{swe.section.name}</TableCell>
                  </TableRow>
                  {swe.entries.length ? (
                    swe.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.account_number}</TableCell>
                        <TableCell>{entry.account_name}</TableCell>
                        <TableCell className="text-right">{entry.debit_opening?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">{entry.credit_opening?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">{entry.debit_turnover?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">{entry.credit_turnover?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">{entry.debit_closing?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">{entry.credit_closing?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Brak danych dla tej sekcji
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Sumowanie sekcji */}
                  <TableRow className="font-medium bg-gray-100">
                    <TableCell colSpan={2}>Suma dla {swe.section.name}</TableCell>
                    <TableCell className="text-right">
                      {swe.entries.reduce((sum, entry) => sum + (entry.debit_opening || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {swe.entries.reduce((sum, entry) => sum + (entry.credit_opening || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {swe.entries.reduce((sum, entry) => sum + (entry.debit_turnover || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {swe.entries.reduce((sum, entry) => sum + (entry.credit_turnover || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {swe.entries.reduce((sum, entry) => sum + (entry.debit_closing || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {swe.entries.reduce((sum, entry) => sum + (entry.credit_closing || 0), 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {/* Suma całkowita */}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={2}>RAZEM</TableCell>
                <TableCell className="text-right">
                  {entries?.reduce((sum, entry) => sum + (entry.debit_opening || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {entries?.reduce((sum, entry) => sum + (entry.credit_opening || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {entries?.reduce((sum, entry) => sum + (entry.debit_turnover || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {entries?.reduce((sum, entry) => sum + (entry.credit_turnover || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {entries?.reduce((sum, entry) => sum + (entry.debit_closing || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {entries?.reduce((sum, entry) => sum + (entry.credit_closing || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // Funkcja renderująca bilans (typowo będzie miała implementacje w przyszłości)
  const renderBalanceSheet = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Bilans</h2>
        <p className="text-muted-foreground mb-4">
          Szczegółowa zawartość bilansu zostanie zaimplementowana w przyszłych wersjach.
        </p>
      </div>
    );
  };

  // Funkcja renderująca rachunek zysków i strat (typowo będzie miała implementacje w przyszłości)
  const renderIncomeStatement = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Rachunek Zysków i Strat (RZiS)</h2>
        <p className="text-muted-foreground mb-4">
          Szczegółowa zawartość rachunku zysków i strat zostanie zaimplementowana w przyszłych wersjach.
        </p>
      </div>
    );
  };

  // Funkcja renderująca JPK (typowo będzie miała implementacje w przyszłości)
  const renderJPKReport = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Jednolity Plik Kontrolny (JPK)</h2>
        <p className="text-muted-foreground mb-4">
          Szczegółowa zawartość JPK zostanie zaimplementowana w przyszłych wersjach.
        </p>
      </div>
    );
  };

  // Funkcja renderująca analizę kosztów i przychodów (typowo będzie miała implementacje w przyszłości)
  const renderAnalysisReport = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Analiza Kosztów i Przychodów</h2>
        <p className="text-muted-foreground mb-4">
          Szczegółowa zawartość analizy kosztów i przychodów zostanie zaimplementowana w przyszłych wersjach.
        </p>
      </div>
    );
  };

  // Funkcja renderująca standardowy raport (typowo będzie miała implementacje w przyszłości)
  const renderStandardReport = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Raport Standardowy</h2>
        <p className="text-muted-foreground mb-4">
          Szczegółowa zawartość standardowego raportu zostanie zaimplementowana w przyszłych wersjach.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-semibold">{report.title}</h1>
        <p className="text-omi-gray-500">Okres: {report.period}</p>
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={exportToExcel} disabled={loading}>
          <FileDown className="h-4 w-4 mr-2" />
          Eksportuj do Excel
        </Button>
        <Button onClick={exportToPdf} disabled={loading}>
          <FileDown className="h-4 w-4 mr-2" />
          Eksportuj do PDF
        </Button>
      </div>

      {renderReportContent()}
    </div>
  );
};

export default ReportDetails;
