
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report, ReportSection, ReportEntry, SectionWithEntries, ReportDetails as ReportDetailsType } from '@/types/reports';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { FileDown, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';

interface ReportDetailsProps {
  reportId: string;
}

const ReportDetails: React.FC<ReportDetailsProps> = ({ reportId }) => {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedEntries, setEditedEntries] = useState<ReportEntry[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ReportEntry | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
  
  // Pobierz szczegóły raportu
  const { data: reportDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['report-details', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_details')
        .select('*')
        .eq('report_id', reportId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ReportDetailsType;
    },
    enabled: !!reportId
  });
  
  // Inicjalizacja edytowanych wpisów, gdy wpisy są dostępne i tryb edycji zostaje włączony
  React.useEffect(() => {
    if (entries && editMode) {
      setEditedEntries([...entries]);
    }
  }, [entries, editMode]);
  
  // Grupujemy wpisy według sekcji
  const sectionsWithEntries: SectionWithEntries[] = React.useMemo(() => {
    if (!sections || !entries) return [];
    
    const entriesBySectionId: Record<string, ReportEntry[]> = {};
    
    // Grupujemy wpisy wg sekcji
    entries.forEach(entry => {
      if (entry.section_id) {
        if (!entriesBySectionId[entry.section_id]) {
          entriesBySectionId[entry.section_id] = [];
        }
        entriesBySectionId[entry.section_id].push(entry);
      }
    });
    
    // Tworzymy wynikową tablicę sekcji z przypisanymi wpisami
    return sections.map(section => {
      return { 
        section, 
        entries: entriesBySectionId[section.id] || []
      };
    });
  }, [sections, entries, editMode, editedEntries]);
  
  // Ustal, które wpisy nie mają przypisanej sekcji
  const entriesWithoutSection = React.useMemo(() => {
    if (!entries) return [];
    return entries.filter(entry => !entry.section_id);
  }, [entries]);
  
  // Mutacja do aktualizacji wpisów raportu
  const updateEntriesMutation = useMutation({
    mutationFn: async (entries: ReportEntry[]) => {
      // Przygotuj dane do aktualizacji
      const updates = entries.map(entry => {
        const { id, report_id, section_id, account_number, account_name, 
               debit_opening, credit_opening, debit_turnover, 
               credit_turnover, debit_closing, credit_closing } = entry;
        
        return {
          id,
          report_id,
          section_id,
          account_number,
          account_name,
          debit_opening,
          credit_opening,
          debit_turnover,
          credit_turnover,
          debit_closing,
          credit_closing
        };
      });
      
      // Aktualizuj wpisy w bazie danych
      const { error } = await supabase
        .from('report_entries')
        .upsert(updates);
        
      if (error) throw error;
      
      // Zaktualizuj również podsumowanie raportu
      await updateReportSummary();
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-entries', reportId] });
      queryClient.invalidateQueries({ queryKey: ['report-details', reportId] });
      setEditMode(false);
      toast({
        title: "Zapisano zmiany",
        description: "Pomyślnie zaktualizowano dane raportu.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zapisać zmian: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Funkcja do aktualizacji podsumowania raportu
  const updateReportSummary = async () => {
    if (!reportId || !editedEntries) return;
    
    try {
      // Oblicz sumy
      let incomeTotal = 0;
      let expenseTotal = 0;
      let settlementsTotal = 0;
      
      editedEntries.forEach(entry => {
        // Konta przychodów (zaczynające się od 7)
        if (entry.account_number.startsWith('7')) {
          incomeTotal += Number(entry.credit_closing || 0) - Number(entry.debit_closing || 0);
        }
        // Konta kosztów (zaczynające się od 4)
        else if (entry.account_number.startsWith('4')) {
          expenseTotal += Number(entry.debit_closing || 0) - Number(entry.credit_closing || 0);
        }
        // Konta rozrachunkowe (zaczynające się od 2)
        else if (entry.account_number.startsWith('2')) {
          settlementsTotal += Math.abs(Number(entry.debit_closing || 0) - Number(entry.credit_closing || 0));
        }
      });
      
      // Oblicz bilans
      const balance = incomeTotal - expenseTotal;
      
      // Aktualizuj lub twórz szczegóły raportu
      if (reportDetails) {
        await supabase
          .from('report_details')
          .update({
            income_total: incomeTotal,
            expense_total: expenseTotal,
            balance: balance,
            settlements_total: settlementsTotal,
            updated_at: new Date().toISOString()
          })
          .eq('report_id', reportId);
      } else {
        await supabase
          .from('report_details')
          .insert({
            report_id: reportId,
            income_total: incomeTotal,
            expense_total: expenseTotal,
            balance: balance,
            settlements_total: settlementsTotal
          });
      }
    } catch (error) {
      console.error('Błąd aktualizacji podsumowania raportu:', error);
    }
  };
  
  // Obsługa zmiany wartości pola wpisu
  const handleEntryChange = (entryId: string, field: keyof ReportEntry, value: string) => {
    setEditedEntries(prev => 
      prev.map(entry => 
        entry.id === entryId 
          ? { ...entry, [field]: field.includes('debit') || field.includes('credit') ? parseFloat(value) || 0 : value }
          : entry
      )
    );
  };
  
  // Funkcja zapisująca zmiany
  const handleSaveChanges = () => {
    updateEntriesMutation.mutate(editedEntries);
  };
  
  // Funkcja do edycji wpisu
  const handleEditEntry = (entry: ReportEntry) => {
    setSelectedEntry(entry);
    setShowEditDialog(true);
  };
  
  // Funkcja zapisująca zmiany w wybranym wpisie
  const saveSelectedEntry = () => {
    if (!selectedEntry) return;
    
    setEditedEntries(prev => 
      prev.map(entry => 
        entry.id === selectedEntry.id ? selectedEntry : entry
      )
    );
    
    setShowEditDialog(false);
  };
  
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

  if (isLoadingReport || isLoadingSections || isLoadingEntries || isLoadingDetails) {
    return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;
  }

  if (!report) {
    return <div className="text-red-600 p-4">Nie znaleziono raportu.</div>;
  }

  // Sprawdź, czy bieżący użytkownik może edytować raport
  const canEdit = report.status === 'draft';

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
                {editMode && <TableHead rowSpan={2} className="text-center">Akcje</TableHead>}
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
                    <TableCell colSpan={editMode ? 9 : 8} className="font-medium">{swe.section.name}</TableCell>
                  </TableRow>
                  {swe.entries.length ? (
                    swe.entries.map((entry) => {
                      // W trybie edycji używamy edytowanych wpisów
                      const editedEntry = editMode 
                        ? editedEntries.find(e => e.id === entry.id) || entry 
                        : entry;
                        
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{editedEntry.account_number}</TableCell>
                          <TableCell>{editedEntry.account_name}</TableCell>
                          <TableCell className="text-right">
                            {editMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedEntry.debit_opening || 0}
                                onChange={(e) => handleEntryChange(entry.id, 'debit_opening', e.target.value)}
                                className="text-right w-24 inline-block"
                              />
                            ) : (
                              editedEntry.debit_opening?.toFixed(2) || '0.00'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedEntry.credit_opening || 0}
                                onChange={(e) => handleEntryChange(entry.id, 'credit_opening', e.target.value)}
                                className="text-right w-24 inline-block"
                              />
                            ) : (
                              editedEntry.credit_opening?.toFixed(2) || '0.00'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedEntry.debit_turnover || 0}
                                onChange={(e) => handleEntryChange(entry.id, 'debit_turnover', e.target.value)}
                                className="text-right w-24 inline-block"
                              />
                            ) : (
                              editedEntry.debit_turnover?.toFixed(2) || '0.00'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedEntry.credit_turnover || 0}
                                onChange={(e) => handleEntryChange(entry.id, 'credit_turnover', e.target.value)}
                                className="text-right w-24 inline-block"
                              />
                            ) : (
                              editedEntry.credit_turnover?.toFixed(2) || '0.00'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedEntry.debit_closing || 0}
                                onChange={(e) => handleEntryChange(entry.id, 'debit_closing', e.target.value)}
                                className="text-right w-24 inline-block"
                              />
                            ) : (
                              editedEntry.debit_closing?.toFixed(2) || '0.00'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedEntry.credit_closing || 0}
                                onChange={(e) => handleEntryChange(entry.id, 'credit_closing', e.target.value)}
                                className="text-right w-24 inline-block"
                              />
                            ) : (
                              editedEntry.credit_closing?.toFixed(2) || '0.00'
                            )}
                          </TableCell>
                          {editMode && (
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditEntry(editedEntry)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={editMode ? 9 : 8} className="text-center text-muted-foreground">
                        Brak danych dla tej sekcji
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Sumowanie sekcji */}
                  <TableRow className="font-medium bg-gray-100">
                    <TableCell colSpan={2}>Suma dla {swe.section.name}</TableCell>
                    <TableCell className="text-right">
                      {(editMode ? editedEntries : swe.entries)
                        .filter(entry => entry.section_id === swe.section.id)
                        .reduce((sum, entry) => sum + (Number(entry.debit_opening) || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(editMode ? editedEntries : swe.entries)
                        .filter(entry => entry.section_id === swe.section.id)
                        .reduce((sum, entry) => sum + (Number(entry.credit_opening) || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(editMode ? editedEntries : swe.entries)
                        .filter(entry => entry.section_id === swe.section.id)
                        .reduce((sum, entry) => sum + (Number(entry.debit_turnover) || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(editMode ? editedEntries : swe.entries)
                        .filter(entry => entry.section_id === swe.section.id)
                        .reduce((sum, entry) => sum + (Number(entry.credit_turnover) || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(editMode ? editedEntries : swe.entries)
                        .filter(entry => entry.section_id === swe.section.id)
                        .reduce((sum, entry) => sum + (Number(entry.debit_closing) || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(editMode ? editedEntries : swe.entries)
                        .filter(entry => entry.section_id === swe.section.id)
                        .reduce((sum, entry) => sum + (Number(entry.credit_closing) || 0), 0)
                        .toFixed(2)}
                    </TableCell>
                    {editMode && <TableCell></TableCell>}
                  </TableRow>
                </React.Fragment>
              ))}
              
              {/* Konta bez przypisanej sekcji */}
              {entriesWithoutSection.length > 0 && (
                <React.Fragment>
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={editMode ? 9 : 8} className="font-medium">Konta bez przypisanej sekcji</TableCell>
                  </TableRow>
                  {entriesWithoutSection.map((entry) => {
                    const editedEntry = editMode 
                      ? editedEntries.find(e => e.id === entry.id) || entry 
                      : entry;
                      
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{editedEntry.account_number}</TableCell>
                        <TableCell>{editedEntry.account_name}</TableCell>
                        <TableCell className="text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editedEntry.debit_opening || 0}
                              onChange={(e) => handleEntryChange(entry.id, 'debit_opening', e.target.value)}
                              className="text-right w-24 inline-block"
                            />
                          ) : (
                            editedEntry.debit_opening?.toFixed(2) || '0.00'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editedEntry.credit_opening || 0}
                              onChange={(e) => handleEntryChange(entry.id, 'credit_opening', e.target.value)}
                              className="text-right w-24 inline-block"
                            />
                          ) : (
                            editedEntry.credit_opening?.toFixed(2) || '0.00'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editedEntry.debit_turnover || 0}
                              onChange={(e) => handleEntryChange(entry.id, 'debit_turnover', e.target.value)}
                              className="text-right w-24 inline-block"
                            />
                          ) : (
                            editedEntry.debit_turnover?.toFixed(2) || '0.00'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editedEntry.credit_turnover || 0}
                              onChange={(e) => handleEntryChange(entry.id, 'credit_turnover', e.target.value)}
                              className="text-right w-24 inline-block"
                            />
                          ) : (
                            editedEntry.credit_turnover?.toFixed(2) || '0.00'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editedEntry.debit_closing || 0}
                              onChange={(e) => handleEntryChange(entry.id, 'debit_closing', e.target.value)}
                              className="text-right w-24 inline-block"
                            />
                          ) : (
                            editedEntry.debit_closing?.toFixed(2) || '0.00'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editedEntry.credit_closing || 0}
                              onChange={(e) => handleEntryChange(entry.id, 'credit_closing', e.target.value)}
                              className="text-right w-24 inline-block"
                            />
                          ) : (
                            editedEntry.credit_closing?.toFixed(2) || '0.00'
                          )}
                        </TableCell>
                        {editMode && (
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditEntry(editedEntry)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              )}
              
              {/* Suma całkowita */}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={2}>RAZEM</TableCell>
                <TableCell className="text-right">
                  {(editMode ? editedEntries : entries)?.reduce((sum, entry) => 
                    sum + (Number(entry.debit_opening) || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {(editMode ? editedEntries : entries)?.reduce((sum, entry) => 
                    sum + (Number(entry.credit_opening) || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {(editMode ? editedEntries : entries)?.reduce((sum, entry) => 
                    sum + (Number(entry.debit_turnover) || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {(editMode ? editedEntries : entries)?.reduce((sum, entry) => 
                    sum + (Number(entry.credit_turnover) || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {(editMode ? editedEntries : entries)?.reduce((sum, entry) => 
                    sum + (Number(entry.debit_closing) || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-right">
                  {(editMode ? editedEntries : entries)?.reduce((sum, entry) => 
                    sum + (Number(entry.credit_closing) || 0), 0).toFixed(2) || '0.00'}
                </TableCell>
                {editMode && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
          
          {editMode && (
            <div className="flex justify-end mt-4 space-x-2">
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Anuluj
              </Button>
              <Button onClick={handleSaveChanges} disabled={updateEntriesMutation.isPending}>
                {updateEntriesMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                Zapisz zmiany
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Funkcja renderująca bilans
  const renderBalanceSheet = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Bilans</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Aktywa */}
          <div className="border p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Aktywa</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria</TableHead>
                  <TableHead className="text-right">Wartość</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionsWithEntries
                  .filter(swe => ['Aktywa trwałe', 'Aktywa obrotowe'].includes(swe.section.name))
                  .map(swe => (
                    <React.Fragment key={swe.section.id}>
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={2} className="font-medium">{swe.section.name}</TableCell>
                      </TableRow>
                      {swe.entries.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.account_name}</TableCell>
                          <TableCell className="text-right">
                            {((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell>Razem {swe.section.name}</TableCell>
                        <TableCell className="text-right">
                          {swe.entries.reduce((sum, entry) => 
                            sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                }
                <TableRow className="font-bold">
                  <TableCell>SUMA AKTYWÓW</TableCell>
                  <TableCell className="text-right">
                    {sectionsWithEntries
                      .filter(swe => ['Aktywa trwałe', 'Aktywa obrotowe'].includes(swe.section.name))
                      .flatMap(swe => swe.entries)
                      .reduce((sum, entry) => 
                        sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          {/* Pasywa */}
          <div className="border p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Pasywa</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria</TableHead>
                  <TableHead className="text-right">Wartość</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionsWithEntries
                  .filter(swe => ['Kapitał (fundusz) własny', 'Zobowiązania i rezerwy na zobowiązania'].includes(swe.section.name))
                  .map(swe => (
                    <React.Fragment key={swe.section.id}>
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={2} className="font-medium">{swe.section.name}</TableCell>
                      </TableRow>
                      {swe.entries.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.account_name}</TableCell>
                          <TableCell className="text-right">
                            {((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell>Razem {swe.section.name}</TableCell>
                        <TableCell className="text-right">
                          {swe.entries.reduce((sum, entry) => 
                            sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                }
                <TableRow className="font-bold">
                  <TableCell>SUMA PASYWÓW</TableCell>
                  <TableCell className="text-right">
                    {sectionsWithEntries
                      .filter(swe => ['Kapitał (fundusz) własny', 'Zobowiązania i rezerwy na zobowiązania'].includes(swe.section.name))
                      .flatMap(swe => swe.entries)
                      .reduce((sum, entry) => 
                        sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  };

  // Funkcja renderująca rachunek zysków i strat
  const renderIncomeStatement = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Rachunek Zysków i Strat (RZiS)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategoria</TableHead>
              <TableHead className="text-right">Wartość</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Przychody */}
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">A. Przychody netto</TableCell>
            </TableRow>
            {sectionsWithEntries
              .find(swe => swe.section.name === 'Przychody netto')?.entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.account_name}</TableCell>
                  <TableCell className="text-right">
                    {((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            }
            <TableRow className="font-medium">
              <TableCell>Razem przychody netto</TableCell>
              <TableCell className="text-right">
                {sectionsWithEntries
                  .find(swe => swe.section.name === 'Przychody netto')?.entries
                  .reduce((sum, entry) => 
                    sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0).toFixed(2) || '0.00'}
              </TableCell>
            </TableRow>
            
            {/* Koszty */}
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">B. Koszty działalności operacyjnej</TableCell>
            </TableRow>
            {sectionsWithEntries
              .find(swe => swe.section.name === 'Koszty działalności operacyjnej')?.entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.account_name}</TableCell>
                  <TableCell className="text-right">
                    {((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            }
            <TableRow className="font-medium">
              <TableCell>Razem koszty działalności operacyjnej</TableCell>
              <TableCell className="text-right">
                {sectionsWithEntries
                  .find(swe => swe.section.name === 'Koszty działalności operacyjnej')?.entries
                  .reduce((sum, entry) => 
                    sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0).toFixed(2) || '0.00'}
              </TableCell>
            </TableRow>
            
            {/* Zysk/strata ze sprzedaży */}
            <TableRow className="font-bold">
              <TableCell>C. Zysk/strata ze sprzedaży (A-B)</TableCell>
              <TableCell className="text-right">
                {(
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Przychody netto')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Koszty działalności operacyjnej')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0)
                ).toFixed(2)}
              </TableCell>
            </TableRow>
            
            {/* Pozostałe przychody i koszty operacyjne */}
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">D. Pozostałe przychody operacyjne</TableCell>
            </TableRow>
            {sectionsWithEntries
              .find(swe => swe.section.name === 'Pozostałe przychody operacyjne')?.entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.account_name}</TableCell>
                  <TableCell className="text-right">
                    {((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            }
            <TableRow className="font-medium">
              <TableCell>Razem pozostałe przychody operacyjne</TableCell>
              <TableCell className="text-right">
                {sectionsWithEntries
                  .find(swe => swe.section.name === 'Pozostałe przychody operacyjne')?.entries
                  .reduce((sum, entry) => 
                    sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0).toFixed(2) || '0.00'}
              </TableCell>
            </TableRow>
            
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">E. Pozostałe koszty operacyjne</TableCell>
            </TableRow>
            {sectionsWithEntries
              .find(swe => swe.section.name === 'Pozostałe koszty operacyjne')?.entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.account_name}</TableCell>
                  <TableCell className="text-right">
                    {((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            }
            <TableRow className="font-medium">
              <TableCell>Razem pozostałe koszty operacyjne</TableCell>
              <TableCell className="text-right">
                {sectionsWithEntries
                  .find(swe => swe.section.name === 'Pozostałe koszty operacyjne')?.entries
                  .reduce((sum, entry) => 
                    sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0).toFixed(2) || '0.00'}
              </TableCell>
            </TableRow>
            
            {/* Zysk/strata z działalności operacyjnej */}
            <TableRow className="font-bold">
              <TableCell>F. Zysk/strata z działalności operacyjnej (C+D-E)</TableCell>
              <TableCell className="text-right">
                {(
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Przychody netto')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Koszty działalności operacyjnej')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0) +
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Pozostałe przychody operacyjne')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Pozostałe koszty operacyjne')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0)
                ).toFixed(2)}
              </TableCell>
            </TableRow>
            
            {/* Przychody i koszty finansowe */}
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">G. Przychody finansowe</TableCell>
            </TableRow>
            {sectionsWithEntries
              .find(swe => swe.section.name === 'Przychody finansowe')?.entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.account_name}</TableCell>
                  <TableCell className="text-right">
                    {((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            }
            <TableRow className="font-medium">
              <TableCell>Razem przychody finansowe</TableCell>
              <TableCell className="text-right">
                {sectionsWithEntries
                  .find(swe => swe.section.name === 'Przychody finansowe')?.entries
                  .reduce((sum, entry) => 
                    sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0).toFixed(2) || '0.00'}
              </TableCell>
            </TableRow>
            
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">H. Koszty finansowe</TableCell>
            </TableRow>
            {sectionsWithEntries
              .find(swe => swe.section.name === 'Koszty finansowe')?.entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.account_name}</TableCell>
                  <TableCell className="text-right">
                    {((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            }
            <TableRow className="font-medium">
              <TableCell>Razem koszty finansowe</TableCell>
              <TableCell className="text-right">
                {sectionsWithEntries
                  .find(swe => swe.section.name === 'Koszty finansowe')?.entries
                  .reduce((sum, entry) => 
                    sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0).toFixed(2) || '0.00'}
              </TableCell>
            </TableRow>
            
            {/* Zysk/strata brutto */}
            <TableRow className="font-bold bg-gray-100">
              <TableCell>I. Zysk/strata brutto (F+G-H)</TableCell>
              <TableCell className="text-right">
                {(
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Przychody netto')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Koszty działalności operacyjnej')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0) +
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Pozostałe przychody operacyjne')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Pozostałe koszty operacyjne')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0) +
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Przychody finansowe')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Koszty finansowe')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0)
                ).toFixed(2)}
              </TableCell>
            </TableRow>
            
            {/* Podatek dochodowy */}
            <TableRow>
              <TableCell>J. Podatek dochodowy</TableCell>
              <TableCell className="text-right">0.00</TableCell>
            </TableRow>
            
            {/* Zysk/strata netto */}
            <TableRow className="font-bold text-lg">
              <TableCell>K. Zysk/strata netto (I-J)</TableCell>
              <TableCell className="text-right">
                {(
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Przychody netto')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Koszty działalności operacyjnej')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0) +
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Pozostałe przychody operacyjne')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Pozostałe koszty operacyjne')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0) +
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Przychody finansowe')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0) || 0) -
                  (sectionsWithEntries
                    .find(swe => swe.section.name === 'Koszty finansowe')?.entries
                    .reduce((sum, entry) => 
                      sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0) || 0)
                ).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  // Funkcja renderująca JPK
  const renderJPKReport = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Jednolity Plik Kontrolny (JPK)</h2>
        <p className="text-omi-gray-500 mb-4">
          Ten raport generuje plik JPK w formacie XML wymaganym przez Krajową Administrację Skarbową.
        </p>
        <div className="border rounded-lg p-4 mb-4">
          <h3 className="text-lg font-medium mb-2">Dane podmiotu</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-omi-gray-500">Nazwa podmiotu:</p>
              <p className="font-medium">Zgromadzenie Misjonarzy Oblatów Maryi Niepokalanej</p>
            </div>
            <div>
              <p className="text-omi-gray-500">NIP:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-omi-gray-500">Adres:</p>
              <p className="font-medium">-</p>
            </div>
            <div>
              <p className="text-omi-gray-500">Kod pocztowy i miasto:</p>
              <p className="font-medium">-</p>
            </div>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 mb-4">
          <h3 className="text-lg font-medium mb-2">Typ JPK</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="border-2">JPK_VAT</Button>
            <Button variant="outline" className="border-2">JPK_KR (księgi rachunkowe)</Button>
            <Button variant="outline" className="border-2">JPK_FA (faktury)</Button>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 mb-4">
          <h3 className="text-lg font-medium mb-2">Okres raportowania</h3>
          <p className="text-omi-gray-500">
            Raport za okres: {report.period}
          </p>
        </div>
        
        <div className="flex justify-center mt-6">
          <Button className="w-full md:w-auto">Generuj plik JPK</Button>
        </div>
      </div>
    );
  };

  // Funkcja renderująca analizę kosztów i przychodów
  const renderAnalysisReport = () => {
    // Grupowanie kont według kategorii i obliczanie sum
    const incomeAccounts = editMode ? editedEntries : entries ? entries : [];
    const incomeData = incomeAccounts
      .filter(entry => entry.account_number.startsWith('7')) // Konta przychodów
      .map(entry => ({
        name: entry.account_name,
        number: entry.account_number,
        value: (Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)
      }))
      .sort((a, b) => b.value - a.value); // Sortuj malejąco wg wartości
    
    const expenseAccounts = editMode ? editedEntries : entries ? entries : [];
    const expenseData = expenseAccounts
      .filter(entry => entry.account_number.startsWith('4')) // Konta kosztów
      .map(entry => ({
        name: entry.account_name,
        number: entry.account_number,
        value: (Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)
      }))
      .sort((a, b) => b.value - a.value); // Sortuj malejąco wg wartości
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Analiza Kosztów i Przychodów</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Przychody */}
          <div className="border p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-4">Struktura przychodów</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeData.map(income => {
                  const totalIncome = incomeData.reduce((sum, item) => sum + item.value, 0);
                  const percentage = totalIncome ? (income.value / totalIncome * 100) : 0;
                  
                  return (
                    <TableRow key={income.number}>
                      <TableCell>{income.number}</TableCell>
                      <TableCell>{income.name}</TableCell>
                      <TableCell className="text-right">{income.value.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{percentage.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold">
                  <TableCell colSpan={2}>RAZEM PRZYCHODY</TableCell>
                  <TableCell className="text-right">
                    {incomeData.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">100.00%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          {/* Koszty */}
          <div className="border p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-4">Struktura kosztów</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseData.map(expense => {
                  const totalExpense = expenseData.reduce((sum, item) => sum + item.value, 0);
                  const percentage = totalExpense ? (expense.value / totalExpense * 100) : 0;
                  
                  return (
                    <TableRow key={expense.number}>
                      <TableCell>{expense.number}</TableCell>
                      <TableCell>{expense.name}</TableCell>
                      <TableCell className="text-right">{expense.value.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{percentage.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold">
                  <TableCell colSpan={2}>RAZEM KOSZTY</TableCell>
                  <TableCell className="text-right">
                    {expenseData.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">100.00%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Podsumowanie finansowe */}
        <div className="border p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4">Podsumowanie finansowe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Suma przychodów</TableCell>
                    <TableCell className="text-right">
                      {incomeData.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Suma kosztów</TableCell>
                    <TableCell className="text-right">
                      {expenseData.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell>Wynik finansowy</TableCell>
                    <TableCell className="text-right">
                      {(
                        incomeData.reduce((sum, item) => sum + item.value, 0) - 
                        expenseData.reduce((sum, item) => sum + item.value, 0)
                      ).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div>
              <p className="text-omi-gray-500 mb-2">Wskaźniki finansowe:</p>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Rentowność</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const totalIncome = incomeData.reduce((sum, item) => sum + item.value, 0);
                        const totalExpense = expenseData.reduce((sum, item) => sum + item.value, 0);
                        const profit = totalIncome - totalExpense;
                        return totalIncome ? ((profit / totalIncome) * 100).toFixed(2) + '%' : 'N/A';
                      })()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Udział kosztów w przychodach</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const totalIncome = incomeData.reduce((sum, item) => sum + item.value, 0);
                        const totalExpense = expenseData.reduce((sum, item) => sum + item.value, 0);
                        return totalIncome ? ((totalExpense / totalIncome) * 100).toFixed(2) + '%' : 'N/A';
                      })()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Funkcja renderująca standardowy raport
  const renderStandardReport = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Raport Standardowy</h2>
        
        {reportDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-1">Przychody</h3>
              <p className="text-2xl font-bold">{reportDetails.income_total.toFixed(2)} PLN</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-1">Koszty</h3>
              <p className="text-2xl font-bold">{reportDetails.expense_total.toFixed(2)} PLN</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-1">Bilans</h3>
              <p className="text-2xl font-bold">{reportDetails.balance.toFixed(2)} PLN</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-1">Rozrachunki</h3>
              <p className="text-2xl font-bold">{reportDetails.settlements_total.toFixed(2)} PLN</p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Przychody według kategorii</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria</TableHead>
                  <TableHead className="text-right">Wartość</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.filter(entry => entry.account_number.startsWith('7'))
                  .map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.account_name}</TableCell>
                      <TableCell className="text-right">
                        {((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                }
                <TableRow className="font-medium">
                  <TableCell>Razem przychody</TableCell>
                  <TableCell className="text-right">
                    {entries?.filter(entry => entry.account_number.startsWith('7'))
                      .reduce((sum, entry) => 
                        sum + ((Number(entry.credit_closing) || 0) - (Number(entry.debit_closing) || 0)), 0).toFixed(2) || '0.00'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          <div className="border p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Koszty według kategorii</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria</TableHead>
                  <TableHead className="text-right">Wartość</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries?.filter(entry => entry.account_number.startsWith('4'))
                  .map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.account_name}</TableCell>
                      <TableCell className="text-right">
                        {((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                }
                <TableRow className="font-medium">
                  <TableCell>Razem koszty</TableCell>
                  <TableCell className="text-right">
                    {entries?.filter(entry => entry.account_number.startsWith('4'))
                      .reduce((sum, entry) => 
                        sum + ((Number(entry.debit_closing) || 0) - (Number(entry.credit_closing) || 0)), 0).toFixed(2) || '0.00'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
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
        {canEdit && !editMode && (
          <Button variant="outline" onClick={() => setEditMode(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edytuj dane
          </Button>
        )}
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
      
      {/* Dialog do edycji wpisu */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edycja danych konta {selectedEntry?.account_number}</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Konto</label>
                  <Input 
                    value={selectedEntry.account_number} 
                    readOnly
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nazwa</label>
                  <Input 
                    value={selectedEntry.account_name} 
                    readOnly
                    className="bg-gray-100"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Bilans otwarcia (Winien)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={selectedEntry.debit_opening || 0}
                    onChange={(e) => setSelectedEntry({
                      ...selectedEntry,
                      debit_opening: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bilans otwarcia (Ma)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={selectedEntry.credit_opening || 0}
                    onChange={(e) => setSelectedEntry({
                      ...selectedEntry,
                      credit_opening: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Obroty (Winien)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={selectedEntry.debit_turnover || 0}
                    onChange={(e) => setSelectedEntry({
                      ...selectedEntry,
                      debit_turnover: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Obroty (Ma)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={selectedEntry.credit_turnover || 0}
                    onChange={(e) => setSelectedEntry({
                      ...selectedEntry,
                      credit_turnover: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Saldo (Winien)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={selectedEntry.debit_closing || 0}
                    onChange={(e) => setSelectedEntry({
                      ...selectedEntry,
                      debit_closing: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Saldo (Ma)</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={selectedEntry.credit_closing || 0}
                    onChange={(e) => setSelectedEntry({
                      ...selectedEntry,
                      credit_closing: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Anuluj</Button>
            <Button onClick={saveSelectedEntry}>Zapisz zmiany</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportDetails;
