
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, FileText } from 'lucide-react';
import Papa from 'papaparse';

interface Account {
  number: string;
  name: string;
  type: string;
}

const AccountsImport: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Determine account type based on account number
  const getAccountType = (accountNumber: string): string => {
    if (!accountNumber) return 'other';
    
    const firstDigit = accountNumber.charAt(0);
    
    switch (firstDigit) {
      case '1': return 'assets'; // Środki trwałe
      case '2': return 'liabilities'; // Rozrachunki
      case '3': return 'equity'; // Kapitały własne
      case '4': return 'expense'; // Koszty według rodzaju
      case '5': return 'expense'; // Koszty według miejsc powstawania
      case '6': return 'assets'; // Produkty
      case '7': return 'income'; // Przychody ze sprzedaży
      case '8': return 'results'; // Pozostałe przychody i koszty operacyjne
      case '9': return 'off_balance'; // Rozrachunki międzyokresowe
      default: return 'other';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      toast({
        title: "Błąd",
        description: "Proszę wybrać plik CSV",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (file: File): Promise<Account[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const accounts: Account[] = results.data.map((row: any) => ({
            number: row.number || row.Number || row.numer || '',
            name: row.name || row.Name || row.nazwa || '',
            type: getAccountType(row.number || row.Number || row.numer || '')
          }));
          resolve(accounts);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Błąd",
        description: "Proszę wybrać plik do importu",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const accounts = await parseCSV(file);
      
      if (accounts.length === 0) {
        throw new Error("Nie znaleziono kont w pliku");
      }

      // Get user's location
      const { data: userLocationId } = await supabase.rpc('get_user_location_id');
      if (!userLocationId) {
        throw new Error("Nie można ustalić lokalizacji użytkownika");
      }

      // Import accounts
      for (const account of accounts) {
        if (account.number && account.name) {
          // Check if account already exists
          const { data: existingAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('number', account.number)
            .single();

          let accountId;

          if (existingAccount) {
            // Update existing account
            const { data: updatedAccount, error: updateError } = await supabase
              .from('accounts')
              .update({
                name: account.name,
                type: account.type
              })
              .eq('number', account.number)
              .select('id')
              .single();

            if (updateError) throw updateError;
            accountId = updatedAccount.id;
          } else {
            // Create new account
            const { data: newAccount, error: insertError } = await supabase
              .from('accounts')
              .insert({
                number: account.number,
                name: account.name,
                type: account.type
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            accountId = newAccount.id;
          }

          // Link account to user's location
          const { error: linkError } = await supabase
            .from('location_accounts')
            .upsert({
              location_id: userLocationId,
              account_id: accountId
            });

          if (linkError) {
            console.warn(`Warning: Could not link account ${account.number} to location:`, linkError);
          }
        }
      }

      toast({
        title: "Sukces",
        description: `Zaimportowano ${accounts.length} kont`,
      });

      setFile(null);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Błąd importu",
        description: error.message || "Wystąpił błąd podczas importu kont",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'number,name\n100,"Kasa"\n130,"Rachunek bankowy"\n201,"Rozrachunki z odbiorcami"\n231,"Rozrachunki publicznoprawne"\n401,"Koszty materiałów i energii"\n701,"Przychody ze sprzedaży"';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'konta_szablon.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Import kont księgowych
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Plik CSV z kontami</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isImporting}
          />
          <p className="text-sm text-omi-gray-500">
            Plik powinien zawierać kolumny: number (numer konta), name (nazwa konta).
            Typ konta zostanie automatycznie określony na podstawie numeru.
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleImport} 
            disabled={!file || isImporting}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {isImporting ? 'Importowanie...' : 'Importuj konta'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Pobierz szablon
          </Button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Automatyczne określanie typów kont według Polskiego Planu Kont:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>1xx:</strong> Środki trwałe (aktywa trwałe)</li>
            <li><strong>2xx:</strong> Rozrachunki (rozrachunki z dostawcami, odbiorcami, ZUS, US)</li>
            <li><strong>3xx:</strong> Kapitały własne (kapitał podstawowy, zyski zatrzymane)</li>
            <li><strong>4xx:</strong> Koszty według rodzaju (materiały, usługi, amortyzacja)</li>
            <li><strong>5xx:</strong> Koszty według miejsc powstawania (koszty działalności)</li>
            <li><strong>6xx:</strong> Produkty (wyroby gotowe, produkty w toku)</li>
            <li><strong>7xx:</strong> Przychody ze sprzedaży (podstawowa działalność operacyjna)</li>
            <li><strong>8xx:</strong> Pozostałe przychody i koszty operacyjne (przychody/koszty finansowe)</li>
            <li><strong>9xx:</strong> Rozrachunki międzyokresowe (bierne, czynne)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountsImport;
