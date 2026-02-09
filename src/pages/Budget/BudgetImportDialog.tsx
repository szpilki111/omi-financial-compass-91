import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileText, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BudgetImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface BudgetImportRow {
  account_prefix: string;
  account_name: string;
  account_type: 'przychód' | 'koszt';
  planned_amount: number;
  previous_year_amount?: number;
}

const BudgetImportDialog: React.FC<BudgetImportDialogProps> = ({ open, onClose, onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<BudgetImportRow[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() + 1);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();

  const isAdminOrProvincial = user?.role === 'admin' || user?.role === 'prowincjal';

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations-for-budget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrProvincial
  });

  // Ustaw domyślną lokalizację
  React.useEffect(() => {
    if (!isAdminOrProvincial && user?.location) {
      setSelectedLocationId(user.location);
    } else if (locations && locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, user?.location, isAdminOrProvincial, selectedLocationId]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      // Parsuj dane - zakładamy nagłówek w pierwszym wierszu
      // Format: Nr konta | Nazwa | Typ | Plan | Wykonanie poprzedniego roku
      const parsedData: BudgetImportRow[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 4) continue;
        
        const accountPrefix = String(row[0] || '').trim();
        const accountName = String(row[1] || '').trim();
        const accountType = String(row[2] || '').toLowerCase().includes('przychód') ? 'przychód' : 'koszt';
        const plannedAmount = parseFloat(String(row[3] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        const previousYearAmount = row[4] ? parseFloat(String(row[4]).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0 : undefined;
        
        if (accountPrefix && accountName) {
          parsedData.push({
            account_prefix: accountPrefix,
            account_name: accountName,
            account_type: accountType as 'przychód' | 'koszt',
            planned_amount: plannedAmount,
            previous_year_amount: previousYearAmount
          });
        }
      }
      
      setPreviewData(parsedData.slice(0, 10));
      
      if (parsedData.length === 0) {
        toast({
          title: "Uwaga",
          description: "Nie znaleziono danych do importu. Sprawdź format pliku.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się odczytać pliku. Sprawdź format.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!file || !selectedLocationId) {
      toast({
        title: "Błąd",
        description: "Wybierz plik i lokalizację",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Sprawdź czy budżet już istnieje
      const { data: existingBudget } = await supabase
        .from('budget_plans')
        .select('id')
        .eq('location_id', selectedLocationId)
        .eq('year', selectedYear)
        .maybeSingle();
      
      if (existingBudget) {
        toast({
          title: "Błąd",
          description: `Budżet na rok ${selectedYear} dla tej lokalizacji już istnieje. Usuń go najpierw.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Parsuj cały plik
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      const budgetItems: BudgetImportRow[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 4) continue;
        
        const accountPrefix = String(row[0] || '').trim();
        const accountName = String(row[1] || '').trim();
        const accountType = String(row[2] || '').toLowerCase().includes('przychód') ? 'przychód' : 'koszt';
        const plannedAmount = parseFloat(String(row[3] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        const previousYearAmount = row[4] ? parseFloat(String(row[4]).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0 : undefined;
        
        if (accountPrefix && accountName) {
          budgetItems.push({
            account_prefix: accountPrefix,
            account_name: accountName,
            account_type: accountType as 'przychód' | 'koszt',
            planned_amount: plannedAmount,
            previous_year_amount: previousYearAmount
          });
        }
      }
      
      if (budgetItems.length === 0) {
        toast({
          title: "Błąd",
          description: "Nie znaleziono danych do importu",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Utwórz budget_plan
      const { data: newBudget, error: budgetError } = await supabase
        .from('budget_plans')
        .insert({
          location_id: selectedLocationId,
          year: selectedYear,
          status: 'draft',
          forecast_method: 'manual',
          created_by: user?.id
        })
        .select()
        .single();
      
      if (budgetError) throw budgetError;
      
      // Utwórz budget_items
      const itemsToInsert = budgetItems.map(item => ({
        budget_plan_id: newBudget.id,
        account_prefix: item.account_prefix,
        account_name: item.account_name,
        account_type: item.account_type === 'przychód' ? 'income' : 'expense',
        planned_amount: item.planned_amount,
        previous_year_amount: item.previous_year_amount || null
      }));
      
      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;
      
      toast({
        title: "Sukces",
        description: `Zaimportowano budżet z ${budgetItems.length} pozycjami`,
      });
      
      onImportComplete();
      onClose();
      
    } catch (error) {
      console.error('Error importing budget:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas importu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Nr konta', 'Nazwa', 'Typ', 'Plan', 'Wykonanie poprzedniego roku'],
      ['701', 'Taca', 'przychód', '50000', '48000'],
      ['702', 'Darowizny', 'przychód', '30000', '28500'],
      ['703', 'Misje/Rekolekcje', 'przychód', '15000', '14000'],
      ['401', 'Biurowe', 'koszt', '5000', '4800'],
      ['402', 'Poczta', 'koszt', '2000', '1900'],
      ['403', 'Telefony, Internet', 'koszt', '3000', '2800'],
      ['404', 'Reprezentacyjne', 'koszt', '2500', '2200'],
      ['410', 'Pralnia, konserwacja', 'koszt', '4000', '3800'],
      ['421', 'Osobiste, higiena', 'koszt', '3500', '3200'],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 25 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Szablon budżetu');
    
    XLSX.writeFile(wb, 'szablon_budzetu.xlsx');
    
    toast({
      title: "Szablon pobrany",
      description: "Szablon budżetu został pobrany"
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import budżetu z pliku Excel
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-year">Rok budżetu</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger id="budget-year">
                  <SelectValue placeholder="Wybierz rok" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {isAdminOrProvincial && (
              <div className="space-y-2">
                <Label htmlFor="budget-location">Lokalizacja</Label>
                <Select
                  value={selectedLocationId}
                  onValueChange={setSelectedLocationId}
                >
                  <SelectTrigger id="budget-location">
                    <SelectValue placeholder="Wybierz lokalizację" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {locations?.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="budget-file">Plik Excel (.xlsx)</Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                id="budget-file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('budget-file')?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Wybierz plik
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Pobierz szablon
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground">{file.name}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Format: Nr konta | Nazwa | Typ (przychód/koszt) | Plan | Wykonanie poprzedniego roku (opcjonalne)
            </p>
          </div>
          
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Podgląd danych (pierwsze 10 pozycji):</Label>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-xs font-medium text-left">Nr konta</th>
                      <th className="px-3 py-2 text-xs font-medium text-left">Nazwa</th>
                      <th className="px-3 py-2 text-xs font-medium text-left">Typ</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Plan</th>
                      <th className="px-3 py-2 text-xs font-medium text-right">Poprz. rok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm font-mono">{row.account_prefix}</td>
                        <td className="px-3 py-2 text-sm">{row.account_name}</td>
                        <td className="px-3 py-2 text-sm">{row.account_type}</td>
                        <td className="px-3 py-2 text-sm text-right">{formatCurrency(row.planned_amount)}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          {row.previous_year_amount ? formatCurrency(row.previous_year_amount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={loading || !file || !selectedLocationId}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importowanie...
              </>
            ) : (
              'Importuj budżet'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetImportDialog;
