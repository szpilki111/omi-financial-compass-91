
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

      // Zaktualizowany plan kont zgodnie z wymaganiami
      const accounts = [
        // 100 – Kasa (środki pieniężne w kasie)
        { number: '100', name: 'Kasa (środki pieniężne w kasie)', type: 'bilansowe zwykłe' },
        { number: '101', name: 'Kasa walutowa EUR', type: 'bilansowe zwykłe - walutowe' },
        { number: '102', name: 'Kasa walutowa USD', type: 'bilansowe zwykłe - walutowe' },
        { number: '103', name: 'Kasa walutowa GBP', type: 'bilansowe zwykłe - walutowe' },
        { number: '110', name: 'Gotówka w banku PLN', type: 'bilansowe zwykłe' },
        { number: '117', name: 'Lokaty bankowe', type: 'bilansowe zwykłe' },
        { number: '149', name: 'Pieniądze w drodze', type: 'bilansowe zwykłe' },
        
        // 200 – Rachunki bankowe (środki na kontach bankowych)
        { number: '200', name: 'Rachunki bankowe (środki na kontach bankowych)', type: 'bilansowe rozrachunkowe' },
        { number: '201', name: 'Rozliczenia z domami', type: 'bilansowe rozrachunkowe' },
        { number: '202', name: 'Rozrachunki z podmiotami zewnętrznymi', type: 'bilansowe rozrachunkowe - walutowe' },
        { number: '208', name: 'Rozliczenie ZUS', type: 'bilansowe rozrachunkowe' },
        { number: '210', name: 'Fundusz intencji', type: 'bilansowe zwykłe' },
        
        // 300 – Rozrachunki z odbiorcami i dostawcami
        { number: '300', name: 'Rozrachunki z odbiorcami i dostawcami', type: 'bilansowe rozrachunkowe' },
        { number: '301', name: 'Magazyn', type: 'bilansowe zwykłe' },
        { number: '310', name: 'Należności krótkoterminowe', type: 'bilansowe rozrachunkowe' },
        { number: '320', name: 'Zobowiązania krótkoterminowe', type: 'bilansowe rozrachunkowe' },
        
        // 400 – Koszty według rodzaju (np. zużycie materiałów, usługi obce)
        { number: '400', name: 'Koszty według rodzaju (np. zużycie materiałów, usługi obce)', type: 'wynikowe zwykłe' },
        { number: '401', name: 'Biurowe', type: 'wynikowe zwykłe' },
        { number: '402', name: 'Poczta', type: 'wynikowe zwykłe' },
        { number: '403', name: 'Telefon', type: 'wynikowe zwykłe' },
        { number: '405', name: 'Prowizje bankowe', type: 'wynikowe zwykłe' },
        { number: '412', name: 'Utrzymanie samochodu', type: 'wynikowe zwykłe' },
        { number: '420', name: 'Pensje zatrudnionych', type: 'wynikowe zwykłe' },
        { number: '440', name: 'Kuchnia, żywność', type: 'wynikowe zwykłe' },
        { number: '444', name: 'Energia, woda', type: 'wynikowe zwykłe' },
        { number: '450', name: 'Inne koszty według rodzaju', type: 'wynikowe zwykłe' },
        
        // 500 – Koszty według typów działalności (np. działalność statutowa)
        { number: '500', name: 'Koszty według typów działalności (np. działalność statutowa)', type: 'wynikowe zwykłe' },
        { number: '501', name: 'Działalność statutowa', type: 'wynikowe zwykłe' },
        { number: '502', name: 'Działalność gospodarcza', type: 'wynikowe zwykłe' },
        { number: '503', name: 'Działalność charytatywna', type: 'wynikowe zwykłe' },
        
        // 700 – Przychody (np. darowizny, składki)
        { number: '700', name: 'Przychody (np. darowizny, składki)', type: 'wynikowe zwykłe' },
        { number: '701', name: 'Taca', type: 'wynikowe zwykłe' },
        { number: '702', name: 'Darowizny', type: 'wynikowe zwykłe' },
        { number: '703', name: 'Składki członkowskie', type: 'wynikowe zwykłe' },
        { number: '704', name: 'Przychody z najmu', type: 'wynikowe zwykłe' },
        { number: '705', name: 'Intencje mszalne', type: 'wynikowe zwykłe' },
        { number: '710', name: 'Inne przychody', type: 'wynikowe zwykłe' },
        
        // 800 – Fundusze własne (np. fundusz statutowy)
        { number: '800', name: 'Fundusze własne (np. fundusz statutowy)', type: 'bilansowe zwykłe' },
        { number: '801', name: 'Fundusz statutowy', type: 'bilansowe zwykłe' },
        { number: '802', name: 'Fundusz zapasowy', type: 'bilansowe zwykłe' },
        { number: '803', name: 'Fundusz celowy', type: 'bilansowe zwykłe' },
        
        // Aktywa trwałe (dodatkowe konta)
        { number: '011', name: 'Grunty', type: 'bilansowe zwykłe' },
        { number: '012', name: 'Budynki', type: 'bilansowe zwykłe' },
        { number: '013', name: 'Wyposażenie i umeblowanie', type: 'bilansowe zwykłe' },
        { number: '015', name: 'Samochody', type: 'bilansowe zwykłe' },
        { number: '020', name: 'Wartości niematerialne i prawne', type: 'bilansowe zwykłe' },
        { number: '030', name: 'Długoterminowe aktywa finansowe', type: 'bilansowe zwykłe' },
      ];

      // Wykonanie importu w mniejszych porcjach
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
        setImportStatus(`Zaimportowano ${importedCount} kont zgodnie z nowym planem kont.`);
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
        Kliknij przycisk poniżej, aby zaimportować zaktualizowany plan kont do bazy danych.
        Plan kont został dostosowany zgodnie z wymaganiami systemu.
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
          'Importuj zaktualizowany plan kont'
        )}
      </Button>
      
      <div className="mt-4 text-xs text-omi-gray-500 max-w-md">
        <p><strong>Nowy plan kont obejmuje:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>100 – Kasa (środki pieniężne w kasie)</li>
          <li>200 – Rachunki bankowe (środki na kontach bankowych)</li>
          <li>300 – Rozrachunki z odbiorcami i dostawcami</li>
          <li>400 – Koszty według rodzaju (np. zużycie materiałów, usługi obce)</li>
          <li>500 – Koszty według typów działalności (np. działalność statutowa)</li>
          <li>700 – Przychody (np. darowizny, składki)</li>
          <li>800 – Fundusze własne (np. fundusz statutowy)</li>
        </ul>
      </div>
    </div>
  );
};

export default AccountsImport;
