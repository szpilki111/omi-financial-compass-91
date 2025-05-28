
import React from 'react';
import { cn } from '@/lib/utils';

interface FinancialCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendColor?: 'green' | 'red' | 'blue';
  loading?: boolean;
}

const FinancialCard: React.FC<FinancialCardProps> = ({
  title,
  amount,
  subtitle,
  icon,
  trend,
  trendColor = 'blue',
  loading
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2
    }).format(value);
  };

  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    return trend === 'up' ? '↗' : '↘';
  };

  const getTrendColor = () => {
    if (!subtitle) return '';
    
    switch (trendColor) {
      case 'green':
        return 'text-green-600';
      case 'red':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-6 w-6 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="text-blue-500">{icon}</div>
      </div>
      
      <div className="space-y-2">
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(amount)}
        </p>
        
        {subtitle && (
          <p className={cn('text-sm flex items-center gap-1', getTrendColor())}>
            {getTrendIcon() && <span>{getTrendIcon()}</span>}
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default FinancialCard;
