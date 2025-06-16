
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, TrendingUp } from 'lucide-react';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface MonthlyData {
  month: string;
  monthName: string;
  transactions: any[];
  debit: number;
  credit: number;
}

interface MonthlyTurnoverViewProps {
  monthlyData: MonthlyData[];
  selectedAccount: Account;
  onViewMonth: (month: number) => void;
}

const MonthlyTurnoverView: React.FC<MonthlyTurnoverViewProps> = ({
  monthlyData,
  selectedAccount,
  onViewMonth,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Obroty miesięczne - konto {selectedAccount.number}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {monthlyData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Brak obrotów do wyświetlenia
          </div>
        ) : (
          <div className="space-y-4">
            {monthlyData.map((monthData) => {
              const monthNumber = parseInt(monthData.month.split('-')[1]);
              const balance = monthData.debit - monthData.credit;
              
              return (
                <div
                  key={monthData.month}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{monthData.monthName}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Operacje</p>
                          <p className="font-medium">
                            {monthData.transactions.length}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Debet</p>
                          <p className="font-medium text-red-600">
                            {monthData.debit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Kredyt</p>
                          <p className="font-medium text-green-600">
                            {monthData.credit.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Saldo</p>
                          <p className={`font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {balance.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Badge variant="outline" className="whitespace-nowrap">
                        {monthData.transactions.length} operacji
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewMonth(monthNumber)}
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <Eye className="h-3 w-3" />
                        Szczegóły
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyTurnoverView;
