
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const AccountsImport: React.FC = () => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const importAccounts = async () => {
    if (isImporting) return;

    setIsImporting(true);
    setImportStatus("Rozpoczęto import...");
    
    try {
      toast({
        title: "Rozpoczęto import",
        description: "Trwa importowanie kont do bazy danych...",
      });

      // Przykładowa lista kont do importu (w prawdziwej implementacji powinna być pełna lista)
      const accounts = [
        { number: '011', name: 'Grunty', type: 'bilansowe zwykłe' },
        { number: '011-1', name: 'Prowincja', type: 'bilansowe zwykłe' },
        { number: '011-1-1', name: 'Wrocław', type: 'bilansowe zwykłe' },
        { number: '011-2', name: 'Domy Prowincji', type: 'bilansowe zwykłe' },
        { number: '012', name: 'Budynki', type: 'bilansowe zwykłe' },
        { number: '012-1', name: 'Prowincja', type: 'bilansowe zwykłe' },
        { number: '012-2', name: 'Domy Prowincji', type: 'bilansowe zwykłe' },
        { number: '013', name: 'Wyposażenie i umeblowanie', type: 'bilansowe zwykłe' },
        { number: '015', name: 'Samochody', type: 'bilansowe zwykłe' },
        { number: '020', name: 'Wartości niematerialne i prawne', type: 'bilansowe zwykłe' },
        { number: '030', name: 'Długoterminowe aktywa finansowe', type: 'bilansowe zwykłe' },
        { number: '100', name: 'Kasa gotówkowa PLN', type: 'bilansowe zwykłe' },
        { number: '101', name: 'Kasa gotówkowa EUR', type: 'bilansowe zwykłe - walutowe' },
        { number: '110', name: 'Bank [PLN]', type: 'bilansowe zwykłe' },
        { number: '117', name: 'Lokaty bankowe', type: 'bilansowe zwykłe' },
        { number: '149', name: 'Pieniądze w drodze', type: 'bilansowe zwykłe' },
        { number: '200', name: 'Prowincja - rozliczenia', type: 'bilansowe rozrachunkowe' },
        { number: '201', name: 'Rozliczenia z domami', type: 'bilansowe rozrachunkowe' },
        { number: '202', name: 'Rozrachunki z podmiotami zewnętrznymi', type: 'bilansowe rozrachunkowe - walutowe' },
        { number: '208', name: 'Rozliczenie ZUS', type: 'bilansowe rozrachunkowe' },
        { number: '210', name: 'Fundusz intencji', type: 'bilansowe zwykłe' },
        { number: '301', name: 'Magazyn', type: 'bilansowe zwykłe' },
        { number: '401', name: 'Biurowe', type: 'wynikowe zwykłe' },
        { number: '402', name: 'Poczta', type: 'wynikowe zwykłe' },
        { number: '403', name: 'Telefon', type: 'wynikowe zwykłe' },
        { number: '405', name: 'Prowizje bankowe', type: 'wynikowe zwykłe' },
        { number: '412', name: 'Utrzymanie samochodu', type: 'wynikowe zwykłe' },
        { number: '420', name: 'Pensje zatrudnionych', type: 'wynikowe zwykłe' },
        { number: '440', name: 'Kuchnia, żywność', type: 'wynikowe zwykłe' },
        { number: '444', name: 'Energia, woda', type: 'wynikowe zwykłe' },
        { number: '450', name: 'Inne', type: 'wynikowe zwykłe' },
        { number: '700', name: 'Przychody', type: 'wynikowe zwykłe' },
        { number: '800', name: 'Majątek', type: 'bilansowe zwykłe' },
        // Dodaj tutaj więcej kont według potrzeb
      ];

      // Wykonanie importu w mniejszych porcjach, aby uniknąć potencjalnych problemów
      const batchSize = 10;
      let importedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < accounts.length; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);
        setImportStatus(`Importowanie kont ${i + 1}-${Math.min(i + batchSize, accounts.length)} z ${accounts.length}...`);
        
        try {
          const { data, error } = await supabase.from('accounts').upsert(
            batch.map(account => ({
              number: account.number,
              name: account.name,
              type: account.type
            })),
            { onConflict: 'number' }
          );

          if (error) {
            console.error("Błąd podczas importu partii kont:", error);
            failedCount += batch.length;
            continue;
          }

          importedCount += batch.length;
        } catch (batchError) {
          console.error("Nieoczekiwany błąd podczas importu partii kont:", batchError);
          failedCount += batch.length;
        }
      }

      // Końcowe podsumowanie
      if (failedCount === 0) {
        toast({
          title: "Sukces",
          description: `Wszystkie ${importedCount} kont zostało zaimportowanych do bazy danych`,
        });
        setImportStatus(`Zaimportowano ${importedCount} kont.`);
      } else {
        toast({
          title: "Import częściowy",
          description: `Zaimportowano ${importedCount} kont, nie udało się zaimportować ${failedCount} kont`,
          variant: "destructive",
        });
        setImportStatus(`Zaimportowano ${importedCount} kont, nie udało się zaimportować ${failedCount} kont.`);
      }
    } catch (error) {
      console.error("Błąd podczas importu kont:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaimportować kont do bazy danych",
        variant: "destructive",
      });
      setImportStatus("Błąd importu. Sprawdź konsolę, aby uzyskać więcej informacji.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 text-sm text-omi-gray-600">
        Kliknij przycisk poniżej, aby zaimportować plan kont do bazy danych.
      </p>
      
      {importStatus && (
        <div className="mb-4 text-sm p-3 bg-omi-gray-100 border border-omi-gray-200 rounded">
          {importStatus}
        </div>
      )}
      
      <Button 
        onClick={importAccounts} 
        className="bg-omi-500"
        disabled={isImporting}
      >
        {isImporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Importowanie...
          </>
        ) : (
          'Importuj plan kont'
        )}
      </Button>
    </div>
  );
};

export default AccountsImport;
