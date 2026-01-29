import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface IntentionsData {
  openingBalance: number;
  celebratedAndGiven: number; // Odprawione i oddane (Ma)
  received: number; // Przyjęte (Wn)
  closingBalance: number; // Wzór: początek + przyjęte - odprawione
}

interface ReportIntentionsTableProps {
  data: IntentionsData;
  className?: string;
}

export const ReportIntentionsTable: React.FC<ReportIntentionsTableProps> = ({
  data,
  className = ''
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Oblicz stan końcowy: początek + przyjęte - odprawione
  const calculatedClosing = data.openingBalance + data.received - data.celebratedAndGiven;

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-bold mb-3">B. Intencje</h3>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold"></TableHead>
            <TableHead className="w-32 text-right font-semibold">Początek miesiąca</TableHead>
            <TableHead className="w-32 text-right font-semibold">Odprawione i oddane</TableHead>
            <TableHead className="w-32 text-right font-semibold">Przyjęte</TableHead>
            <TableHead className="w-32 text-right font-semibold">Stan końcowy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">1. Intencje</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(data.openingBalance)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(data.celebratedAndGiven)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(data.received)}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(calculatedClosing)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportIntentionsTable;
