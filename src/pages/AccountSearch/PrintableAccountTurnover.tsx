import React from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  date: string;
  document_number: string;
  description: string;
  amount: number;
  debit_amount?: number;
  credit_amount?: number;
  debit_account_id: string;
  credit_account_id: string;
  document?: {
    document_number: string;
    document_name: string;
  };
}

interface PrintableAccountTurnoverProps {
  account: Account;
  transactions: Transaction[];
  year: number;
  totals: {
    debit: number;
    credit: number;
    balance: number;
  };
  locationName?: string;
}

const PrintableAccountTurnover = React.forwardRef<HTMLDivElement, PrintableAccountTurnoverProps>(
  ({ account, transactions, year, totals, locationName }, ref) => {
    
    const formatAmount = (amount?: number) => {
      if (amount === undefined || amount === 0) return '';
      return amount.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Grupuj transakcje po miesiącach
    const transactionsByMonth = transactions.reduce((acc, t) => {
      const month = format(parseISO(t.date), 'yyyy-MM');
      if (!acc[month]) acc[month] = [];
      acc[month].push(t);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const sortedMonths = Object.keys(transactionsByMonth).sort();

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
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
            }
          }
        `}</style>

        {/* Header */}
        <div className="mb-3 border-b-2 border-gray-800 pb-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-base font-bold">Obroty na koncie</h1>
              {locationName && <p className="text-[9px] text-gray-600">{locationName}</p>}
            </div>
            <div className="text-right">
              <p className="font-bold text-sm">Rok {year}</p>
            </div>
          </div>
          <div className="mt-2 bg-gray-100 p-2">
            <p className="font-bold">{account.number} - {account.name}</p>
            <p className="text-[9px] text-gray-600">Typ: {account.type}</p>
          </div>
        </div>

        {/* Podsumowanie roczne na górze */}
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[9px] text-gray-600">Obroty Wn (debet)</p>
              <p className="font-bold text-red-600">{formatAmount(totals.debit)} zł</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-600">Obroty Ma (kredyt)</p>
              <p className="font-bold text-green-600">{formatAmount(totals.credit)} zł</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-600">Saldo</p>
              <p className={`font-bold ${totals.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatAmount(totals.balance)} zł
              </p>
            </div>
          </div>
        </div>

        {/* Transakcje pogrupowane po miesiącach */}
        {sortedMonths.map(month => {
          const monthTransactions = transactionsByMonth[month];
          const monthDebit = monthTransactions.reduce((sum, t) => 
            sum + (t.debit_account_id === account.id ? (t.debit_amount || t.amount || 0) : 0), 0);
          const monthCredit = monthTransactions.reduce((sum, t) => 
            sum + (t.credit_account_id === account.id ? (t.credit_amount || t.amount || 0) : 0), 0);
          
          const firstDate = parseISO(monthTransactions[0].date);
          const monthName = format(firstDate, 'LLLL yyyy', { locale: pl });

          return (
            <div key={month} className="mb-3">
              <h3 className="text-[11px] font-bold bg-gray-100 px-1 py-0.5 mb-1">
                {monthName} ({monthTransactions.length} operacji)
              </h3>
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left py-0.5 px-1 w-16">Data</th>
                    <th className="text-left py-0.5 px-1 w-20">Dokument</th>
                    <th className="text-left py-0.5 px-1">Opis</th>
                    <th className="text-right py-0.5 px-1 w-20">Wn</th>
                    <th className="text-right py-0.5 px-1 w-20">Ma</th>
                  </tr>
                </thead>
                <tbody>
                  {monthTransactions.map((t) => {
                    const isDebit = t.debit_account_id === account.id;
                    const isCredit = t.credit_account_id === account.id;
                    
                    return (
                      <tr key={t.id} className="border-b border-gray-200">
                        <td className="py-0.5 px-1">{format(parseISO(t.date), 'dd.MM')}</td>
                        <td className="py-0.5 px-1 truncate" title={t.document?.document_name}>
                          {t.document?.document_number || t.document_number || '-'}
                        </td>
                        <td className="py-0.5 px-1 truncate max-w-[200px]" title={t.description}>
                          {t.description}
                        </td>
                        <td className="py-0.5 px-1 text-right">
                          {isDebit ? formatAmount(t.debit_amount || t.amount) : ''}
                        </td>
                        <td className="py-0.5 px-1 text-right">
                          {isCredit ? formatAmount(t.credit_amount || t.amount) : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-400 font-bold bg-gray-50">
                    <td colSpan={3} className="py-0.5 px-1 text-right">Razem {monthName}:</td>
                    <td className="py-0.5 px-1 text-right">{formatAmount(monthDebit)}</td>
                    <td className="py-0.5 px-1 text-right">{formatAmount(monthCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}

        {transactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Brak operacji na tym koncie w roku {year}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-gray-300">
          <p className="text-[8px] text-gray-500 text-center">
            Wydrukowano: {format(new Date(), 'dd.MM.yyyy HH:mm', { locale: pl })} | Liczba operacji: {transactions.length}
          </p>
        </div>
      </div>
    );
  }
);

PrintableAccountTurnover.displayName = 'PrintableAccountTurnover';

export default PrintableAccountTurnover;
