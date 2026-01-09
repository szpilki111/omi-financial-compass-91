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
      <div ref={ref} className="print-container hidden print:block bg-white text-black" style={{ fontSize: '8px', padding: '4mm' }}>
        <style>{`
          @media print {
            @page { size: A4; margin: 5mm; }
            .print-container { display: block !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        `}</style>

        {/* Nagłówek - kompaktowy */}
        <div style={{ marginBottom: '2mm', borderBottom: '1px solid #000', paddingBottom: '1mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>{account.number}</span>
              <span style={{ marginLeft: '8px' }}>{account.name}</span>
            </div>
            <div style={{ fontWeight: 'bold' }}>Rok {year}</div>
          </div>
          {locationName && <div style={{ fontSize: '7px', color: '#666' }}>{locationName}</div>}
        </div>

        {/* Wszystkie transakcje w jednej tabeli */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000', background: '#f0f0f0' }}>
              <th style={{ padding: '1px 2px', textAlign: 'left', width: '50px' }}>Data</th>
              <th style={{ padding: '1px 2px', textAlign: 'left', width: '70px' }}>Dokument</th>
              <th style={{ padding: '1px 2px', textAlign: 'left' }}>Opis</th>
              <th style={{ padding: '1px 2px', textAlign: 'right', width: '70px' }}>Wn</th>
              <th style={{ padding: '1px 2px', textAlign: 'right', width: '70px' }}>Ma</th>
            </tr>
          </thead>
          <tbody>
            {sortedMonths.map(month => {
              const monthTransactions = transactionsByMonth[month];
              const firstDate = parseISO(monthTransactions[0].date);
              const monthName = format(firstDate, 'LLL', { locale: pl });
              
              const monthDebit = monthTransactions.reduce((sum, t) => 
                sum + (t.debit_account_id === account.id ? (t.debit_amount || t.amount || 0) : 0), 0);
              const monthCredit = monthTransactions.reduce((sum, t) => 
                sum + (t.credit_account_id === account.id ? (t.credit_amount || t.amount || 0) : 0), 0);

              return (
                <React.Fragment key={month}>
                  {/* Nagłówek miesiąca - pojedynczy wiersz */}
                  <tr style={{ background: '#e8e8e8' }}>
                    <td colSpan={5} style={{ padding: '1px 2px', fontWeight: 'bold', fontSize: '7px' }}>
                      {monthName.toUpperCase()} ({monthTransactions.length})
                    </td>
                  </tr>
                  {/* Transakcje */}
                  {monthTransactions.map((t) => {
                    const isDebit = t.debit_account_id === account.id;
                    const isCredit = t.credit_account_id === account.id;
                    
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0 2px' }}>{format(parseISO(t.date), 'dd.MM')}</td>
                        <td style={{ padding: '0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70px' }}>
                          {t.document?.document_number || t.document_number || '-'}
                        </td>
                        <td style={{ padding: '0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                          {t.description}
                        </td>
                        <td style={{ padding: '0 2px', textAlign: 'right' }}>
                          {isDebit ? formatAmount(t.debit_amount || t.amount) : ''}
                        </td>
                        <td style={{ padding: '0 2px', textAlign: 'right' }}>
                          {isCredit ? formatAmount(t.credit_amount || t.amount) : ''}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Suma miesiąca */}
                  <tr style={{ borderBottom: '1px solid #999', fontSize: '7px' }}>
                    <td colSpan={3} style={{ padding: '0 2px', textAlign: 'right', fontWeight: 'bold' }}>Σ {monthName}:</td>
                    <td style={{ padding: '0 2px', textAlign: 'right', fontWeight: 'bold' }}>{formatAmount(monthDebit)}</td>
                    <td style={{ padding: '0 2px', textAlign: 'right', fontWeight: 'bold' }}>{formatAmount(monthCredit)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '9px' }}>
              <td colSpan={3} style={{ padding: '2px', textAlign: 'right' }}>RAZEM ROK {year}:</td>
              <td style={{ padding: '2px', textAlign: 'right' }}>{formatAmount(totals.debit)}</td>
              <td style={{ padding: '2px', textAlign: 'right' }}>{formatAmount(totals.credit)}</td>
            </tr>
            <tr style={{ fontWeight: 'bold', fontSize: '9px' }}>
              <td colSpan={3} style={{ padding: '2px', textAlign: 'right' }}>SALDO:</td>
              <td colSpan={2} style={{ padding: '2px', textAlign: 'right', color: totals.balance >= 0 ? '#006600' : '#cc0000' }}>
                {formatAmount(totals.balance)} zł
              </td>
            </tr>
          </tfoot>
        </table>

        {transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            Brak operacji na tym koncie w roku {year}
          </div>
        )}
      </div>
    );
  }
);

PrintableAccountTurnover.displayName = 'PrintableAccountTurnover';

export default PrintableAccountTurnover;
