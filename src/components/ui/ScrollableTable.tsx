import React from 'react';
import { cn } from '@/lib/utils';

interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollableTable = ({ children, className }: ScrollableTableProps) => {
  return (
    <div className="relative">
      <div
        className={cn("overflow-x-auto", className)}
        data-scrollable-table="true"
      >
        {children}
      </div>
    </div>
  );
};
