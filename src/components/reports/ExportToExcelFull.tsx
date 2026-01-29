import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Report } from '@/types/reports';

interface ExportToExcelFullProps {
  report: Report;
  locationName: string;
}

// Nowa lista kont przychodów - tylko 7xx zgodnie z planem
const INCOME_ACCOUNTS = [
  { number: '701', name: 'Intencje odprawione na dom' },
  { number: '702', name: 'Duszpasterstwo OMI' },
  { number: '703', name: 'Duszpasterstwo parafialne' },
  { number: '704', name: 'Kolęda' },
  { number: '705', name: 'Zastępstwa zagraniczne' },
  { number: '706', name: 'Ofiary okazjonalne' },
  { number: '707', name: 'Stypendia, dotacje, emerytury' },
  { number: '708', name: 'Dotacje z kurii' },
  { number: '709', name: 'Wynajem, dzierżawa' },
  { number: '710', name: 'Odsetki' },
  { number: '711', name: 'Sprzedaż towarów' },
  { number: '712', name: 'Dzierżawa' },
  { number: '713', name: 'Przychód ze sprzedaży' },
  { number: '714', name: 'Pensje, emerytury' },
  { number: '715', name: 'Zwroty' },
  { number: '716', name: 'Usługi' },
  { number: '717', name: 'Inne' },
  { number: '718', name: 'Rekolektanci' },
  { number: '719', name: 'Dzierżawa przechodnia' },
  { number: '720', name: 'Ofiary' },
  { number: '721', name: 'Darowizny' },
  { number: '722', name: 'Pensje katechetów' },
  { number: '725', name: 'Nadzwyczajne' },
  { number: '727', name: 'Ogród' },
  { number: '728', name: 'Gospodarstwo' },
  { number: '730', name: 'Sprzedaż majątku trwałego' },
];

// Nowa lista kont rozchodów - tylko 4xx zgodnie z planem
const EXPENSE_ACCOUNTS = [
  { number: '401', name: 'Żywność' },
  { number: '402', name: 'Alkohol' },
  { number: '403', name: 'Opłaty za energię' },
  { number: '404', name: 'Opłaty telefoniczne' },
  { number: '405', name: 'Opłaty komunalne' },
  { number: '406', name: 'Transport' },
  { number: '407', name: 'Opłaty administracyjne' },
  { number: '408', name: 'Ubezpieczenia' },
  { number: '409', name: 'Remonty, naprawy' },
  { number: '410', name: 'Wyposażenie' },
  { number: '411', name: 'Materiały biurowe' },
  { number: '412', name: 'Prenumerata, książki' },
  { number: '413', name: 'Środki czystości' },
  { number: '414', name: 'Odzież' },
  { number: '415', name: 'Leczenie' },
  { number: '416', name: 'Formacja, studia' },
  { number: '417', name: 'Duszpasterstwo' },
  { number: '418', name: 'Podróże służbowe' },
  { number: '419', name: 'Urlopy, rekolekcje' },
  { number: '420', name: 'Reprezentacja' },
  { number: '421', name: 'Wynagrodzenia' },
  { number: '422', name: 'ZUS' },
  { number: '423', name: 'Usługi obce' },
  { number: '424', name: 'Inwestycje' },
  { number: '425', name: 'Wydatki bankowe' },
  { number: '430', name: 'Podatki' },
  { number: '431', name: 'Książki, czasopisma' },
  { number: '435', name: 'Wakacje' },
  { number: '440', name: 'Żywność dodatkowa' },
  { number: '441', name: 'Salon' },
  { number: '442', name: 'Odzież dodatkowa' },
  { number: '443', name: 'Pralnia' },
  { number: '444', name: 'Energia, woda' },
  { number: '445', name: 'Podatki dodatkowe' },
  { number: '446', name: 'Ogród' },
  { number: '447', name: 'Gospodarstwo' },
  { number: '449', name: 'Zakup towarów do sprzedaży' },
  { number: '450', name: 'Różne wydatki' },
  { number: '451', name: 'Remonty zwyczajne' },
  { number: '452', name: 'Remonty nadzwyczajne' },
  { number: '453', name: 'Spotkania, zjazdy' },
  { number: '455', name: 'Studia' },
  { number: '456', name: 'Powołania' },
  { number: '457', name: 'Apostolat' },
  { number: '458', name: 'Biedni' },
  { number: '459', name: 'Misje' },
];

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

export const ExportToExcelFull: React.FC<ExportToExcelFullProps> = ({
  report,
  locationName
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const getMonthName = (m: number) => {
    const months = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    return months[m - 1] || '';
  };

const handleExport = async () => {
  setIsExporting(true);
  try {
    const { month, year, location_id } = report;

    // Pobranie danych lokalizacji
    const { data: locationData } = await supabase
      .from('locations')
      .select('*')
      .eq('id', location_id)
      .single();

    // Zakres dat
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
    const dateTo = lastDayOfMonth.toISOString().split('T')[0];

    // Pobranie transakcji
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        debit_account:accounts!transactions_debit_account_id_fkey(id, number, name),
        credit_account:accounts!transactions_credit_account_id_fkey(id, number, name)
      `)
      .eq('location_id', location_id)
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (error) throw error;

    // Przetwarzanie transakcji
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    const financialStatusMap = new Map<string, { debits: number; credits: number }>();
    const liabilitiesMap = new Map<string, { receivables: number; liabilities: number }>();
    let intentions210Received = 0;
    let intentions210CelebratedGiven = 0;

    transactions?.forEach(tx => {
      // Strona Ma (credit)
      if (tx.credit_account) {
        const accNum = tx.credit_account.number;
        const prefix = accNum.split('-')[0];
        const amount = tx.credit_amount || tx.amount || 0;

        if (prefix.startsWith('7')) {
          incomeMap.set(prefix, (incomeMap.get(prefix) || 0) + amount);
        }
        if (prefix.startsWith('1')) {
          const existing = financialStatusMap.get(prefix) || { debits: 0, credits: 0 };
          existing.credits += amount;
          financialStatusMap.set(prefix, existing);
        }
        if (prefix.startsWith('2')) {
          const existing = liabilitiesMap.get(prefix) || { receivables: 0, liabilities: 0 };
          existing.liabilities += amount;
          liabilitiesMap.set(prefix, existing);
        }
        if (prefix === '210') {
          intentions210CelebratedGiven += amount;
        }
      }

      // Strona Wn (debit)
      if (tx.debit_account) {
        const accNum = tx.debit_account.number;
        const prefix = accNum.split('-')[0];
        const amount = tx.debit_amount || tx.amount || 0;

        if (prefix.startsWith('4')) {
          expenseMap.set(prefix, (expenseMap.get(prefix) || 0) + amount);
        }
        if (prefix.startsWith('1')) {
          const existing = financialStatusMap.get(prefix) || { debits: 0, credits: 0 };
          existing.debits += amount;
          financialStatusMap.set(prefix, existing);
        }
        if (prefix.startsWith('2')) {
          const existing = liabilitiesMap.get(prefix) || { receivables: 0, liabilities: 0 };
          existing.receivables += amount;
          liabilitiesMap.set(prefix, existing);
        }
        if (prefix === '210') {
          intentions210Received += amount;
        }
      }
    });

    // Tworzenie skoroszytu
    const wb = XLSX.utils.book_new();

    // ────────────────────────────────────────────────
    // ARKUSZ 1 – Strona 1 (Stan finansowy, Intencje, Należności)
    // ────────────────────────────────────────────────
    const sheet1Data: (string | number | null)[][] = [];

    sheet1Data.push([locationData?.name || '']);
    sheet1Data.push([`${locationData?.postal_code || ''} ${locationData?.city || ''}`]);
    sheet1Data.push([locationData?.address || '']);
    sheet1Data.push(['']);
    sheet1Data.push([`SPRAWOZDANIE MIESIĘCZNE ZA OKRES: ${getMonthName(month).toUpperCase()} ${year} r.`]);
    sheet1Data.push(['']);

    // A. Stan finansowy domu
    sheet1Data.push(['A. Stan finansowy domu']);
    sheet1Data.push(['', 'Początek miesiąca', 'Uznania', 'Obciążenia', 'Koniec miesiąca']);

    let totalOpening = 0;
    let totalDebits = 0;
    let totalCredits = 0;
    let totalClosing = 0;

    FINANCIAL_STATUS_CATEGORIES.forEach(category => {
      let categoryDebits = 0;
      let categoryCredits = 0;
      category.accounts.forEach(acc => {
        const data = financialStatusMap.get(acc);
        if (data) {
          categoryDebits += data.debits;
          categoryCredits += data.credits;
        }
      });
      const opening = 0; // brak danych historycznych
      const closing = opening + categoryDebits - categoryCredits;

      totalOpening += opening;
      totalDebits += categoryDebits;
      totalCredits += categoryCredits;
      totalClosing += closing;

      sheet1Data.push([category.name, opening, categoryDebits, categoryCredits, closing]);
    });

    sheet1Data.push(['SALDO', totalOpening, totalDebits, totalCredits, totalClosing]);
    sheet1Data.push(['']);

    // B. Intencje
    sheet1Data.push(['B. Intencje']);
    sheet1Data.push(['', 'Początek miesiąca', 'Odprawione i oddane', 'Przyjęte', 'Stan końcowy']);
    const intentionsOpening = 0;
    const intentionsClosing = intentionsOpening + intentions210Received - intentions210CelebratedGiven;
    sheet1Data.push(['1. Intencje', intentionsOpening, intentions210CelebratedGiven, intentions210Received, intentionsClosing]);
    sheet1Data.push(['']);

    // C. Należności i zobowiązania
    sheet1Data.push(['C. Należności i zobowiązania']);
    sheet1Data.push(['', 'Początek miesiąca', 'Należności', 'Zobowiązania', 'Koniec miesiąca']);

    LIABILITY_CATEGORIES.forEach(category => {
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
      sheet1Data.push([category.name, opening, receivables, liabilities, closing]);
    });
    sheet1Data.push(['']);

    // Podpisy
    sheet1Data.push([`Przyjęto na radzie domowej dnia ................${year} r.`]);
    sheet1Data.push(['']);
    sheet1Data.push(['SUPERIOR', 'EKONOM', 'PROBOSZCZ', 'I Radny', 'II Radny']);
    sheet1Data.push(['']);
    sheet1Data.push([`Prowincja Misjonarzy Oblatów M.N. PEKAO S.A. ${locationData?.bank_account || ''}`]);

    const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Data);

    sheet1['!cols'] = [
      { wch: 30.84 },
      { wch: 18.83 },
      { wch: 18.83 },
      { wch: 18.83 },
      { wch: 18.83 }
    ];

    sheet1['!margins'] = {
      left: 0.39,
      right: 0.39,
      top: 0.39,
      bottom: 0.39,
      header: 0.3,
      footer: 0.3
    };

    sheet1['!pageSetup'] = {
      orientation: 'landscape'
    };

    // Czcionka 12 dla całego arkusza 1
    const range1 = XLSX.utils.decode_range(sheet1['!ref']);
    for (let R = range1.s.r; R <= range1.e.r; ++R) {
      for (let C = range1.s.c; C <= range1.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (!sheet1[cell_ref]) continue;
        sheet1[cell_ref].s = sheet1[cell_ref].s || {};
        sheet1[cell_ref].s.font = { sz: 12 };
      }
    }

    XLSX.utils.book_append_sheet(wb, sheet1, 'Strona 1');

    // ────────────────────────────────────────────────
    // ARKUSZ 2 – Strona 2 (Przychody i Rozchody)
    // ────────────────────────────────────────────────
    const sheet2Data: (string | number | null)[][] = [];

    sheet2Data.push(['I. PRZYCHODY', null, null, null, 'II. ROZCHODY', null, null]);
    sheet2Data.push([null, null, null, null, null, null, null]);
    sheet2Data.push(['Nr. konta', 'Treść', 'kwota', null, 'Nr. konta', 'Treść', 'kwota']);

    let totalIncome = 0;
    INCOME_ACCOUNTS.forEach(acc => {
      totalIncome += incomeMap.get(acc.number) || 0;
    });

    let totalExpense = 0;
    EXPENSE_ACCOUNTS.forEach(acc => {
      totalExpense += expenseMap.get(acc.number) || 0;
    });

    const maxLen = Math.max(INCOME_ACCOUNTS.length, EXPENSE_ACCOUNTS.length);
    for (let i = 0; i < maxLen; i++) {
      const incAcc = i < INCOME_ACCOUNTS.length ? INCOME_ACCOUNTS[i] : { number: null, name: null };
      const expAcc = i < EXPENSE_ACCOUNTS.length ? EXPENSE_ACCOUNTS[i] : { number: null, name: null };
      const incAmount = incomeMap.get(incAcc.number) || 0;
      const expAmount = expenseMap.get(expAcc.number) || 0;

      sheet2Data.push([
        incAcc.number, incAcc.name, incAmount, null,
        expAcc.number, expAcc.name, expAmount
      ]);
    }

    sheet2Data.push([null, null, null, null, null, null, null]);
    sheet2Data.push([null, 'PRZYCHODY RAZEM:', totalIncome, null, null, 'ROZCHODY RAZEM:', totalExpense]);

    const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Data);

    sheet2['!cols'] = [
      { wch: 7.59 }, { wch: 22.69 }, { wch: 5.82 }, { wch: 3.25 },
      { wch: 8.97 }, { wch: 20.91 }, { wch: 16.47 }
    ];

    // Marginesy 1 cm (≈ 0.3937 cala)
    sheet2['!margins'] = {
      left: 0.39,
      right: 0.39,
      top: 0.39,
      bottom: 0.39,
      header: 0.3,
      footer: 0.3
    };

    // Czcionka 10 dla całego arkusza 2
    const range2 = XLSX.utils.decode_range(sheet2['!ref']);
    for (let R = range2.s.r; R <= range2.e.r; ++R) {
      for (let C = range2.s.c; C <= range2.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (!sheet2[cell_ref]) continue;
        sheet2[cell_ref].s = sheet2[cell_ref].s || {};
        sheet2[cell_ref].s.font = { sz: 10 };
      }
    }

    // Orientacja pionowa (domyślna) – możesz zmienić na 'landscape' jeśli chcesz
    // sheet2['!pageSetup'] = { orientation: 'portrait' };

    XLSX.utils.book_append_sheet(wb, sheet2, 'Strona 2');

    // ────────────────────────────────────────────────
    // Zapis pliku
    // ────────────────────────────────────────────────
    const monthNames = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paz', 'lis', 'gru'];
    const filename = `sprawozdanie_${(locationData?.name || 'lokalizacja').replace(/\s+/g, '_')}_${monthNames[month - 1]}_${year}.xlsx`;

    XLSX.writeFile(wb, filename);

    toast.success('Raport wyeksportowany do Excel zgodnie ze wzorem');
  } catch (error: any) {
    console.error('Export error:', error);
    toast.error('Błąd eksportu: ' + (error.message || 'nieznany błąd'));
  } finally {
    setIsExporting(false);
  }
};

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      Eksport do Excel (pełny)
    </Button>
  );
};

export default ExportToExcelFull;
