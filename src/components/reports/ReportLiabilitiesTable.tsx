import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LiabilityRow {
  name: string;
  openingBalance: number;
  receivables: number; // Należności (Wn)
  liabilities: number; // Zobowiązania (Ma)
  closingBalance: number; // Wzór: początek + należności - zobowiązania
}

interface ReportLiabilitiesTableProps {
  data: LiabilityRow[];
  className?: string;
}

// Nowa struktura kategorii zgodna z planem
const DEFAULT_LIABILITY_CATEGORIES = [
  { key: 'loans_given', name: '1. Pożyczki udzielone', accounts: ['212', '213'] },
  { key: 'loans_taken', name: '2. Pożyczki zaciągnięte', accounts: ['215'] },
  { key: 'province', name: '3. Rozliczenia z prowincją', accounts: ['201'] },
  { key: 'others', name: '4. Rozliczenia z innymi', accounts: ['217'] },
];

export const ReportLiabilitiesTable: React.FC<ReportLiabilitiesTableProps> = ({
  data,
  className = ''
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-bold mb-3">D. Należności i zobowiązania</h3>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold"></TableHead>
            <TableHead className="w-28 text-right font-semibold">Początek miesiąca</TableHead>
            <TableHead className="w-28 text-right font-semibold">Należności</TableHead>
            <TableHead className="w-28 text-right font-semibold">Zobowiązania</TableHead>
            <TableHead className="w-28 text-right font-semibold">Koniec miesiąca</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            // Oblicz stan końcowy: początek + należności - zobowiązania
            const calculatedClosing = row.openingBalance + row.receivables - row.liabilities;
            return (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(row.openingBalance)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(row.receivables)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(row.liabilities)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(calculatedClosing)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export { DEFAULT_LIABILITY_CATEGORIES };
export default ReportLiabilitiesTable;
