import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LiabilityRow {
  name: string;
  receivablesOpening?: number;
  liabilitiesOpening?: number;
  receivablesChange?: number;
  liabilitiesChange?: number;
  receivablesClosing?: number;
  liabilitiesClosing?: number;
}

interface ReportLiabilitiesTableProps {
  data: LiabilityRow[];
  className?: string;
}

// Predefiniowane kategorie należności i zobowiązań
const DEFAULT_LIABILITY_CATEGORIES = [
  { key: 'loans_given', name: '1. Pożyczki udzielone', accounts: ['212', '213'] },
  { key: 'loans_taken', name: '2. Pożyczki zaciągnięte', accounts: ['215'] },
  { key: 'transitory', name: '3. Sumy przechodnie', accounts: ['149', '150'] },
  { key: 'province', name: '4. Rozliczenia z prowincją', accounts: ['200', '201'] },
  { key: 'others', name: '5. Rozliczenia z innymi', accounts: ['202', '208'] },
];

export const ReportLiabilitiesTable: React.FC<ReportLiabilitiesTableProps> = ({
  data,
  className = ''
}) => {
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '';
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
            <TableHead className="font-semibold" rowSpan={2}></TableHead>
            <TableHead className="w-24 text-center font-semibold border-r" colSpan={2}>Stan początkowy</TableHead>
            <TableHead className="w-24 text-center font-semibold border-r" colSpan={2}>Zmiany</TableHead>
            <TableHead className="w-24 text-center font-semibold" colSpan={2}>Stan końcowy</TableHead>
          </TableRow>
          <TableRow className="bg-muted/30">
            <TableHead className="w-24 text-right text-xs">należności</TableHead>
            <TableHead className="w-24 text-right text-xs border-r">zobowiązania</TableHead>
            <TableHead className="w-24 text-right text-xs">należności</TableHead>
            <TableHead className="w-24 text-right text-xs border-r">zobowiązania</TableHead>
            <TableHead className="w-24 text-right text-xs">należności</TableHead>
            <TableHead className="w-24 text-right text-xs">zobowiązania</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(row.receivablesOpening)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm border-r">
                {formatCurrency(row.liabilitiesOpening)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(row.receivablesChange)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm border-r">
                {formatCurrency(row.liabilitiesChange)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(row.receivablesClosing)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(row.liabilitiesClosing)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export { DEFAULT_LIABILITY_CATEGORIES };
export default ReportLiabilitiesTable;
