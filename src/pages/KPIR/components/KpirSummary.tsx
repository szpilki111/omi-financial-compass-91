
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KpirSummaryProps {
  income: number;
  expense: number;
  balance: number;
  openingBalance?: number;
  closingBalance?: number;
}

const KpirSummary: React.FC<KpirSummaryProps> = ({ 
  income, 
  expense, 
  balance, 
  openingBalance,
  closingBalance 
}) => {
  const cards = [];

  // Saldo początkowe (jeśli dostępne)
  if (openingBalance !== undefined) {
    cards.push(
      <Card key="opening">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Saldo początkowe</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${openingBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {openingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
          </p>
          <p className="text-xs text-omi-gray-500 mt-1">
            Stan środków na początek okresu
          </p>
        </CardContent>
      </Card>
    );
  }

  // Przychody
  cards.push(
    <Card key="income">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Przychody</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-green-600">
          {income.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
        </p>
        <p className="text-xs text-omi-gray-500 mt-1">
          Suma wszystkich przychodów okresu (konta 7xx po stronie kredytu)
        </p>
      </CardContent>
    </Card>
  );

  // Rozchody
  cards.push(
    <Card key="expense">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Rozchody</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-red-600">
          {Math.abs(expense).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
        </p>
        <p className="text-xs text-omi-gray-500 mt-1">
          Suma wszystkich kosztów okresu (konta 4xx, 5xx po stronie debetu)
        </p>
      </CardContent>
    </Card>
  );

  // Saldo okresu
  cards.push(
    <Card key="balance">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Saldo okresu</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {balance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
        </p>
        <p className="text-xs text-omi-gray-500 mt-1">
          Przychody - Rozchody okresu
        </p>
      </CardContent>
    </Card>
  );

  // Saldo końcowe (jeśli dostępne)
  if (closingBalance !== undefined) {
    cards.push(
      <Card key="closing">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Saldo końcowe</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${closingBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {closingBalance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
          </p>
          <p className="text-xs text-omi-gray-500 mt-1">
            Saldo początkowe + Saldo okresu
          </p>
        </CardContent>
      </Card>
    );
  }

  const gridCols = cards.length <= 3 ? `grid-cols-${cards.length}` : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <div className={`grid grid-cols-1 md:${gridCols} gap-4`}>
      {cards}
    </div>
  );
};

export default KpirSummary;
