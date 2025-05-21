
import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  change?: number;
  status?: 'success' | 'warning' | 'error' | 'neutral';
  statusText?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  className,
  change,
  status,
  statusText,
}) => {
  const renderTrendIndicator = () => {
    if (!trend || !trendValue) return null;

    const trendClasses = {
      up: 'text-green-600',
      down: 'text-red-600',
      neutral: 'text-omi-gray-500',
    };

    const trendSymbol = {
      up: '↑',
      down: '↓',
      neutral: '→',
    };

    return (
      <span className={cn('text-sm font-medium', trendClasses[trend])}>
        {trendSymbol[trend]} {trendValue}
      </span>
    );
  };

  const renderStatus = () => {
    if (!status || !statusText) return null;

    const statusClasses = {
      success: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
      error: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200',
    };

    return (
      <Badge variant="outline" className={cn('text-xs px-2 py-0.5 font-medium', statusClasses[status])}>
        {statusText}
      </Badge>
    );
  };

  return (
    <div
      className={cn(
        'bg-white p-6 rounded-lg shadow-sm border border-omi-gray-200',
        className
      )}
    >
      <div className="flex items-start">
        {icon && <div className="mr-4 text-omi-400">{icon}</div>}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-omi-gray-500">{title}</h3>
          <div className="mt-1 flex items-baseline">
            <p className="text-2xl font-semibold text-omi-gray-800">{value}</p>
            {trend && trendValue && (
              <p className="ml-2 flex items-baseline">{renderTrendIndicator()}</p>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-omi-gray-500">{description}</p>
          )}
          {change !== undefined && (
            <p className="mt-1 text-sm">
              <span className={cn(
                'font-medium',
                change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-omi-gray-500'
              )}>
                {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}%
              </span>
            </p>
          )}
          {status && statusText && (
            <div className="mt-2">
              {renderStatus()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
