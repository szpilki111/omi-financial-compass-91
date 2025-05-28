
import React from 'react';
import { cn } from '@/lib/utils';

interface QuickAccessCardProps {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const QuickAccessCard: React.FC<QuickAccessCardProps> = ({
  title,
  icon,
  onClick,
  disabled = false,
  className
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-white p-4 rounded-lg shadow-sm border text-left transition-all duration-200',
        'hover:shadow-md hover:scale-105 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed hover:shadow-sm hover:scale-100',
        className
      )}
    >
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="text-blue-500 p-2 bg-blue-50 rounded-lg">
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-700 leading-tight">
          {title}
        </span>
      </div>
    </button>
  );
};

export default QuickAccessCard;
