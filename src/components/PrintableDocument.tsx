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

const PrintableDocument = React.forwardRef<HTMLDivElement, PrintableDocumentProps>(
  ({ documentNumber, documentName, documentDate, currency, transactions, parallelTransactions, accounts, locationName }, ref) => {
    const getAccountDisplay = (accountId?: string) => {
      if (!accountId) return '-';
      const account = accounts.find(a => a.id === accountId);
      return account ? `${account.number} - ${account.name}` : '-';
    };

    const formatAmount = (amount?: number) => {
      if (amount === undefined || amount === 0) return '-';
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

    return (
      <div ref={ref} className="print-container hidden print:block p-8 bg-white text-black">
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 1cm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .print-container {
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Header */}
        <div className="mb-6 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold mb-2">Dokument księgowy</h1>
          {locationName && <p className="text-sm text-gray-600">{locationName}</p>}
        </div>

        {/* Document Info */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Numer dokumentu:</p>
            <p className="font-bold text-lg">{documentNumber}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Data dokumentu:</p>
            <p className="font-bold text-lg">{format(documentDate, 'dd.MM.yyyy', { locale: pl })}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-600">Nazwa dokumentu:</p>
            <p className="font-bold">{documentName}</p>
          </div>
        </div>

        {/* Main Transactions */}
        {transactions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-3 border-b border-gray-400 pb-2">Operacje główne</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2 px-2 w-8">Lp.</th>
                  <th className="text-left py-2 px-2">Opis</th>
                  <th className="text-right py-2 px-2 w-24">Winien</th>
                  <th className="text-left py-2 px-2">Konto Wn</th>
                  <th className="text-right py-2 px-2 w-24">Ma</th>
                  <th className="text-left py-2 px-2">Konto Ma</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 px-2">{index + 1}</td>
                    <td className="py-2 px-2">{transaction.description || '-'}</td>
                    <td className="py-2 px-2 text-right">{formatAmount(transaction.debit_amount)}</td>
                    <td className="py-2 px-2 text-xs">{getAccountDisplay(transaction.debit_account_id)}</td>
                    <td className="py-2 px-2 text-right">{formatAmount(transaction.credit_amount)}</td>
                    <td className="py-2 px-2 text-xs">{getAccountDisplay(transaction.credit_account_id)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800 font-bold">
                  <td colSpan={2} className="py-2 px-2 text-right">RAZEM:</td>
                  <td className="py-2 px-2 text-right">{formatAmount(mainDebitSum)} {getCurrencySymbol(currency)}</td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2 text-right">{formatAmount(mainCreditSum)} {getCurrencySymbol(currency)}</td>
                  <td className="py-2 px-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Parallel Transactions */}
        {parallelTransactions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-3 border-b border-gray-400 pb-2">Księgowanie równoległe</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2 px-2 w-8">Lp.</th>
                  <th className="text-left py-2 px-2">Opis</th>
                  <th className="text-right py-2 px-2 w-24">Winien</th>
                  <th className="text-left py-2 px-2">Konto Wn</th>
                  <th className="text-right py-2 px-2 w-24">Ma</th>
                  <th className="text-left py-2 px-2">Konto Ma</th>
                </tr>
              </thead>
              <tbody>
                {parallelTransactions.map((transaction, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-2 px-2">{index + 1}</td>
                    <td className="py-2 px-2">{transaction.description || '-'}</td>
                    <td className="py-2 px-2 text-right">{formatAmount(transaction.debit_amount)}</td>
                    <td className="py-2 px-2 text-xs">{getAccountDisplay(transaction.debit_account_id)}</td>
                    <td className="py-2 px-2 text-right">{formatAmount(transaction.credit_amount)}</td>
                    <td className="py-2 px-2 text-xs">{getAccountDisplay(transaction.credit_account_id)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800 font-bold">
                  <td colSpan={2} className="py-2 px-2 text-right">RAZEM:</td>
                  <td className="py-2 px-2 text-right">{formatAmount(parallelDebitSum)} {getCurrencySymbol(currency)}</td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2 text-right">{formatAmount(parallelCreditSum)} {getCurrencySymbol(currency)}</td>
                  <td className="py-2 px-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary */}
        <div className="mt-8 p-4 bg-gray-100 border-2 border-gray-800">
          <h3 className="font-bold text-lg mb-3">Podsumowanie dokumentu</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Winien razem</p>
              <p className="font-bold text-lg">{formatAmount(totalDebitSum)} {getCurrencySymbol(currency)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ma razem</p>
              <p className="font-bold text-lg">{formatAmount(totalCreditSum)} {getCurrencySymbol(currency)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Suma całkowita</p>
              <p className="font-bold text-lg">{formatAmount(totalDebitSum + totalCreditSum)} {getCurrencySymbol(currency)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-400">
          <p className="text-xs text-gray-600 text-center">
            Wydrukowano: {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: pl })}
          </p>
        </div>
      </div>
    );
  }
);

PrintableDocument.displayName = 'PrintableDocument';

export default PrintableDocument;
