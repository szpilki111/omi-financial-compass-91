
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface Operation {
  id: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  date: string;
  description: string;
}

interface MonthlyTurnoversDialogProps {
  account: Account | null;
  operations: Operation[];
  year: number;
  isOpen: boolean;
  onClose: () => void;
}

const MonthlyTurnoversDialog = ({ account, operations, year, isOpen, onClose }: MonthlyTurnoversDialogProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const getMonthlyData = () => {
    const monthlyData = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const monthOperations = operations.filter(op => {
        const opDate = new Date(op.date);
        return opDate.getMonth() + 1 === month;
      });

      const income = monthOperations
        .filter(op => op.transaction_type === 'income')
        .reduce((sum, op) => sum + op.amount, 0);

      const expense = monthOperations
        .filter(op => op.transaction_type === 'expense')
        .reduce((sum, op) => sum + op.amount, 0);

      const balance = income - expense;

      return {
        month,
        monthName: new Date(year, index, 1).toLocaleDateString('pl-PL', { month: 'long' }),
        income,
        expense,
        balance,
        operations: monthOperations
      };
    });

    return monthlyData;
  };

  const monthlyData = getMonthlyData();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Obroty miesięczne - {account?.number} {account?.name} ({year})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthlyData.map((data) => (
              <Card key={data.month} className={data.operations.length > 0 ? 'border-blue-200' : 'border-gray-200'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {data.monthName}
                    {data.operations.length > 0 && (
                      <Badge variant="outline">{data.operations.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-sm text-gray-600">Przychody:</span>
                    </div>
                    <span className="font-medium text-green-600">
                      {formatCurrency(data.income)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span className="text-sm text-gray-600">Rozchody:</span>
                    </div>
                    <span className="font-medium text-red-600">
                      {formatCurrency(data.expense)}
                    </span>
                  </div>
                  
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Saldo:</span>
                      <span className={`font-bold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.balance)}
                      </span>
                    </div>
                  </div>

                  {data.operations.length > 0 && (
                    <div className="mt-3 pt-2 border-t">
                      <p className="text-xs text-gray-500 mb-2">Najnowsze operacje:</p>
                      <div className="space-y-1">
                        {data.operations.slice(0, 3).map((op) => (
                          <div key={op.id} className="text-xs">
                            <div className="flex justify-between items-start">
                              <span className="text-gray-700 truncate flex-1 mr-2">
                                {op.description}
                              </span>
                              <span className={`font-medium ${op.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {op.transaction_type === 'income' ? '+' : '-'}{formatCurrency(op.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                        {data.operations.length > 3 && (
                          <p className="text-xs text-gray-400">
                            ... i {data.operations.length - 3} więcej
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary for the year */}
          <Card className="mt-6 bg-blue-50">
            <CardHeader>
              <CardTitle>Podsumowanie roczne {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Łączne przychody</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(monthlyData.reduce((sum, data) => sum + data.income, 0))}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Łączne rozchody</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(monthlyData.reduce((sum, data) => sum + data.expense, 0))}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Saldo końcowe</p>
                  <p className={`text-2xl font-bold ${
                    monthlyData.reduce((sum, data) => sum + data.balance, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(monthlyData.reduce((sum, data) => sum + data.balance, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MonthlyTurnoversDialog;
