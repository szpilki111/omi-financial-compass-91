import React from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Transaction {
  id?: string;
  description?: string;
  debit_account_id?: string;
  credit_account_id?: string;
  debit_amount?: number;
  credit_amount?: number;
  amount?: number;
  currency?: string;
  display_order?: number;
}

interface Account {
  id: string;
  number: string;
  name: string;
}

interface PrintableDocumentProps {
  documentNumber: string;
  documentName: string;
  documentDate: Date;
  currency: string;
  transactions: Transaction[];
  parallelTransactions: Transaction[];
  accounts: Account[];
  locationName?: string;
}

// Funkcja do grupowania kont analitycznych w syntetyczne
const groupToSynthetic = (transactions: Transaction[], accounts: Account[]) => {
  const syntheticMap = new Map<string, {
    description: string;
    debit_total: number;
    credit_total: number;
    debit_prefix: string;
    credit_prefix: string;
    debit_name: string;
    credit_name: string;
  }>();

  transactions.forEach(t => {
    const debitAccount = accounts.find(a => a.id === t.debit_account_id);
    const creditAccount = accounts.find(a => a.id === t.credit_account_id);
    
    // Pobierz prefix syntetyczny (przed myślnikiem)
    const debitPrefix = debitAccount?.number.split('-')[0] || '';
    const creditPrefix = creditAccount?.number.split('-')[0] || '';
    const key = `${debitPrefix}_${creditPrefix}`;
    
    const existing = syntheticMap.get(key);
    if (existing) {
      existing.debit_total += t.debit_amount || 0;
      existing.credit_total += t.credit_amount || 0;
    } else {
      syntheticMap.set(key, {
        description: t.description || '',
        debit_total: t.debit_amount || 0,
        credit_total: t.credit_amount || 0,
        debit_prefix: debitPrefix,
        credit_prefix: creditPrefix,
        debit_name: debitAccount?.name.split('-')[0].trim() || '',
        credit_name: creditAccount?.name.split('-')[0].trim() || '',
      });
    }
  });

  return Array.from(syntheticMap.values());
};

const PrintableDocument = React.forwardRef<HTMLDivElement, PrintableDocumentProps>(
  ({ documentNumber, documentName, documentDate, currency, transactions, parallelTransactions, accounts, locationName }, ref) => {
    
    const formatAmount = (amount?: number) => {
      if (amount === undefined || amount === 0) return '';
      return amount.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getCurrencySymbol = (curr: string) => {
      const symbols: { [key: string]: string } = {
        PLN: 'zł',
        EUR: '€',
        USD: '$',
        GBP: '£',
        CHF: 'CHF',
      };
      return symbols[curr] || curr;
    };

    const mainDebitSum = transactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0);
    const mainCreditSum = transactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0);
    const parallelDebitSum = parallelTransactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0);
    const parallelCreditSum = parallelTransactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0);
    const totalDebitSum = mainDebitSum + parallelDebitSum;
    const totalCreditSum = mainCreditSum + parallelCreditSum;

    // Filtruj puste transakcje
    const filteredTransactions = transactions.filter(t => 
      (t.debit_amount && t.debit_amount > 0) || (t.credit_amount && t.credit_amount > 0)
    );
    const filteredParallel = parallelTransactions.filter(t => 
      (t.debit_amount && t.debit_amount > 0) || (t.credit_amount && t.credit_amount > 0)
    );

    const getAccountDisplay = (accountId?: string, compact = true) => {
      if (!accountId) return '-';
      const account = accounts.find(a => a.id === accountId);
      if (!account) return '-';
      // Kompaktowy wyświetlacz: tylko numer i skrócona nazwa
      if (compact) {
        const shortName = account.name.length > 20 ? account.name.substring(0, 20) + '...' : account.name;
        return `${account.number} ${shortName}`;
      }
      return `${account.number} - ${account.name}`;
    };

    return (
      <div ref={ref} className="print-container hidden print:block p-4 bg-white text-black" style={{ fontSize: '10px' }}>
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0.8cm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .print-container {
              display: block !important;
              font-size: 10px !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        `}</style>

        {/* Header - kompaktowy */}
        <div className="mb-3 border-b border-gray-800 pb-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-base font-bold">Dokument księgowy</h1>
              {locationName && <p className="text-[9px] text-gray-600">{locationName}</p>}
            </div>
            <div className="text-right">
              <p className="font-bold">{documentNumber}</p>
              <p className="text-[9px]">{format(documentDate, 'dd.MM.yyyy', { locale: pl })}</p>
            </div>
          </div>
          <p className="text-[9px] mt-1"><strong>Nazwa:</strong> {documentName}</p>
        </div>

        {/* Main Transactions - zagęszczone */}
        {filteredTransactions.length > 0 && (
          <div className="mb-3">
            <h2 className="text-[11px] font-bold mb-1 bg-gray-100 px-1">Operacje główne</h2>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-0.5 px-1 w-5">#</th>
                  <th className="text-left py-0.5 px-1">Opis</th>
                  <th className="text-right py-0.5 px-1 w-16">Wn</th>
                  <th className="text-left py-0.5 px-1 w-28">Konto Wn</th>
                  <th className="text-right py-0.5 px-1 w-16">Ma</th>
                  <th className="text-left py-0.5 px-1 w-28">Konto Ma</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-0.5 px-1">{index + 1}</td>
                    <td className="py-0.5 px-1 truncate max-w-[120px]" title={transaction.description}>
                      {transaction.description || '-'}
                    </td>
                    <td className="py-0.5 px-1 text-right">{formatAmount(transaction.debit_amount)}</td>
                    <td className="py-0.5 px-1 text-[8px] truncate">{getAccountDisplay(transaction.debit_account_id)}</td>
                    <td className="py-0.5 px-1 text-right">{formatAmount(transaction.credit_amount)}</td>
                    <td className="py-0.5 px-1 text-[8px] truncate">{getAccountDisplay(transaction.credit_account_id)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-600 font-bold">
                  <td colSpan={2} className="py-0.5 px-1 text-right">RAZEM:</td>
                  <td className="py-0.5 px-1 text-right">{formatAmount(mainDebitSum)}</td>
                  <td className="py-0.5 px-1"></td>
                  <td className="py-0.5 px-1 text-right">{formatAmount(mainCreditSum)}</td>
                  <td className="py-0.5 px-1 text-[8px]">{getCurrencySymbol(currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Parallel Transactions - zagęszczone */}
        {filteredParallel.length > 0 && (
          <div className="mb-3">
            <h2 className="text-[11px] font-bold mb-1 bg-gray-100 px-1">Księgowanie równoległe</h2>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-0.5 px-1 w-5">#</th>
                  <th className="text-left py-0.5 px-1">Opis</th>
                  <th className="text-right py-0.5 px-1 w-16">Wn</th>
                  <th className="text-left py-0.5 px-1 w-28">Konto Wn</th>
                  <th className="text-right py-0.5 px-1 w-16">Ma</th>
                  <th className="text-left py-0.5 px-1 w-28">Konto Ma</th>
                </tr>
              </thead>
              <tbody>
                {filteredParallel.map((transaction, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-0.5 px-1">{index + 1}</td>
                    <td className="py-0.5 px-1 truncate max-w-[120px]" title={transaction.description}>
                      {transaction.description || '-'}
                    </td>
                    <td className="py-0.5 px-1 text-right">{formatAmount(transaction.debit_amount)}</td>
                    <td className="py-0.5 px-1 text-[8px] truncate">{getAccountDisplay(transaction.debit_account_id)}</td>
                    <td className="py-0.5 px-1 text-right">{formatAmount(transaction.credit_amount)}</td>
                    <td className="py-0.5 px-1 text-[8px] truncate">{getAccountDisplay(transaction.credit_account_id)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-600 font-bold">
                  <td colSpan={2} className="py-0.5 px-1 text-right">RAZEM:</td>
                  <td className="py-0.5 px-1 text-right">{formatAmount(parallelDebitSum)}</td>
                  <td className="py-0.5 px-1"></td>
                  <td className="py-0.5 px-1 text-right">{formatAmount(parallelCreditSum)}</td>
                  <td className="py-0.5 px-1 text-[8px]">{getCurrencySymbol(currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary - kompaktowe */}
        <div className="mt-3 p-2 bg-gray-100 border border-gray-600">
          <h3 className="font-bold text-[11px] mb-1">Podsumowanie</h3>
          <div className="grid grid-cols-3 gap-2 text-center text-[9px]">
            <div>
              <p className="text-gray-600">Winien</p>
              <p className="font-bold">{formatAmount(totalDebitSum)} {getCurrencySymbol(currency)}</p>
            </div>
            <div>
              <p className="text-gray-600">Ma</p>
              <p className="font-bold">{formatAmount(totalCreditSum)} {getCurrencySymbol(currency)}</p>
            </div>
            <div>
              <p className="text-gray-600">Kontrola (Wn = Ma)</p>
              <p className={`font-bold ${Math.abs(totalDebitSum - totalCreditSum) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>
                {Math.abs(totalDebitSum - totalCreditSum) < 0.01 ? '✓ OK' : `Δ ${formatAmount(Math.abs(totalDebitSum - totalCreditSum))}`}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-gray-300">
          <p className="text-[8px] text-gray-500 text-center">
            Wydrukowano: {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: pl })}
          </p>
        </div>
      </div>
    );
  }
);

PrintableDocument.displayName = 'PrintableDocument';

export default PrintableDocument;
