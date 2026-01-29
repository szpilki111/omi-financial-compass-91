import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FinancialStatusRow {
  name: string;
  openingBalance: number;
  debits: number; // Uznania (Wn)
  credits: number; // Obciążenia (Ma)
  closingBalance: number;
}

interface ReportFinancialStatusTableProps {
  data: FinancialStatusRow[];
  className?: string;
}

// Nowa struktura kategorii zgodna z planem
const DEFAULT_CATEGORIES = [
  { 
    key: 'kasa_domu', 
    name: '1. Kasa domu', 
    accounts: ['100', '101', '102', '103', '104', '105', '106', '107', '108', '109'] 
  },
  { 
    key: 'bank', 
    name: '2. Bank', 
    accounts: ['110', '111', '112', '113', '114', '115', '116'] 
  },
  { 
    key: 'lokaty', 
    name: '3. Lokaty bankowe', 
    accounts: ['117'] 
  },
];

export const ReportFinancialStatusTable: React.FC<ReportFinancialStatusTableProps> = ({
  data,
  className = ''
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Oblicz sumy dla wiersza SALDO
  const totals = data.reduce(
    (acc, row) => ({
      openingBalance: acc.openingBalance + row.openingBalance,
      debits: acc.debits + row.debits,
      credits: acc.credits + row.credits,
      closingBalance: acc.closingBalance + row.closingBalance,
    }),
    { openingBalance: 0, debits: 0, credits: 0, closingBalance: 0 }
  );

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-bold mb-3">A. Stan finansowy domu</h3>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold"></TableHead>
            <TableHead className="w-32 text-right font-semibold">Początek miesiąca</TableHead>
            <TableHead className="w-32 text-right font-semibold">Uznania</TableHead>
            <TableHead className="w-32 text-right font-semibold">Obciążenia</TableHead>
            <TableHead className="w-32 text-right font-semibold">Koniec miesiąca</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.openingBalance)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.debits)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.credits)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.closingBalance)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted font-bold border-t-2">
            <TableCell>SALDO</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totals.openingBalance)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totals.debits)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totals.credits)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(totals.closingBalance)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export { DEFAULT_CATEGORIES };
export default ReportFinancialStatusTable;
