
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KpirSummaryProps {
  income: number;
  expense: number;
  balance: number;
}

const KpirSummary: React.FC<KpirSummaryProps> = ({ income, expense, balance }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Przychody</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">
            {income.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
          </p>
          <p className="text-xs text-omi-gray-500 mt-1">
            Suma wszystkich przychodów (konta 7xx i 200 po stronie kredytu)
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rozchody</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-red-600">
            {expense.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
          </p>
          <p className="text-xs text-omi-gray-500 mt-1">
            Suma wszystkich kosztów (konta 4xx i 200 po stronie debetu)
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Bilans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
          </p>
          <p className="text-xs text-omi-gray-500 mt-1">
            Przychody - Rozchody
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default KpirSummary;
