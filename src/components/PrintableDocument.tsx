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
  locationAddress?: string;
}

const PrintableDocument = React.forwardRef<HTMLDivElement, PrintableDocumentProps>(
  ({ documentNumber, documentName, documentDate, currency, transactions, parallelTransactions, accounts, locationName, locationAddress }, ref) => {
    
    const formatAmount = (amount?: number) => {
      if (amount === undefined || amount === 0) return '';
      return amount.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getCurrencySymbol = (curr: string) => {
      const symbols: { [key: string]: string } = { PLN: 'zł', EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };
      return symbols[curr] || curr;
    };

    // Połącz wszystkie transakcje
    const allTransactions = [...transactions, ...parallelTransactions].filter(t => 
      (t.debit_amount && t.debit_amount > 0) || (t.credit_amount && t.credit_amount > 0)
    );

    const totalDebit = allTransactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0);
    const totalCredit = allTransactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0);

    const getAccountNumber = (accountId?: string) => {
      if (!accountId) return '';
      return accounts.find(a => a.id === accountId)?.number || '';
    };

    return (
      <div ref={ref} className="print-content" style={{ fontSize: '9pt', padding: '5mm', background: 'white', color: 'black' }}>

        {/* Nagłówek - kompaktowy jak Symfonia */}
        <div style={{ marginBottom: '2mm' }}>
          <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{locationName}</div>
          {locationAddress && <div style={{ fontSize: '8px' }}>{locationAddress}</div>}
        </div>

        {/* Tytuł dokumentu */}
        <div style={{ textAlign: 'center', marginBottom: '3mm', borderBottom: '1px solid #000', paddingBottom: '2mm' }}>
          <div style={{ fontWeight: 'bold', fontSize: '11px' }}>POLECENIE KSIĘGOWANIA nr {documentNumber}</div>
          <div style={{ fontSize: '9px' }}>{documentName}</div>
        </div>

        {/* Daty w 2 kolumnach */}
        <table style={{ width: '100%', marginBottom: '3mm', fontSize: '8px' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%' }}>Data dokumentu: <strong>{format(documentDate, 'dd.MM.yyyy')}</strong></td>
              <td style={{ width: '50%' }}>Data operacji: <strong>{format(documentDate, 'dd.MM.yyyy')}</strong></td>
            </tr>
            <tr>
              <td>Okres: <strong>{format(documentDate, 'MM/yyyy')}</strong></td>
              <td>Waluta: <strong>{currency}</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Tabela transakcji - jedna tabela bez sekcji */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000', background: '#f0f0f0' }}>
              <th style={{ padding: '1px 2px', textAlign: 'left', width: '16px' }}>Lp</th>
              <th style={{ padding: '1px 2px', textAlign: 'left' }}>Treść zapisu</th>
              <th style={{ padding: '1px 2px', textAlign: 'right', width: '60px' }}>Kwota Wn</th>
              <th style={{ padding: '1px 2px', textAlign: 'left', width: '70px' }}>Konto Wn</th>
              <th style={{ padding: '1px 2px', textAlign: 'right', width: '60px' }}>Kwota Ma</th>
              <th style={{ padding: '1px 2px', textAlign: 'left', width: '70px' }}>Konto Ma</th>
            </tr>
          </thead>
          <tbody>
            {allTransactions.map((t, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '0 2px' }}>{idx + 1}</td>
                <td style={{ padding: '0 2px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '-'}</td>
                <td style={{ padding: '0 2px', textAlign: 'right' }}>{formatAmount(t.debit_amount)}</td>
                <td style={{ padding: '0 2px' }}>{getAccountNumber(t.debit_account_id)}</td>
                <td style={{ padding: '0 2px', textAlign: 'right' }}>{formatAmount(t.credit_amount)}</td>
                <td style={{ padding: '0 2px' }}>{getAccountNumber(t.credit_account_id)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ padding: '1px 2px', textAlign: 'right' }}>Razem:</td>
              <td style={{ padding: '1px 2px', textAlign: 'right' }}>{formatAmount(totalDebit)}</td>
              <td style={{ padding: '1px 2px' }}>{getCurrencySymbol(currency)}</td>
              <td style={{ padding: '1px 2px', textAlign: 'right' }}>{formatAmount(totalCredit)}</td>
              <td style={{ padding: '1px 2px' }}>{getCurrencySymbol(currency)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Kontrola */}
        {Math.abs(totalDebit - totalCredit) >= 0.01 && (
          <div style={{ marginTop: '2mm', color: 'red', fontSize: '8px' }}>
            ⚠ Niezgodność: Δ = {formatAmount(Math.abs(totalDebit - totalCredit))} {getCurrencySymbol(currency)}
          </div>
        )}
      </div>
    );
  }
);

PrintableDocument.displayName = 'PrintableDocument';

export default PrintableDocument;
