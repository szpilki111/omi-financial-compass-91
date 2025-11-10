import React from 'react';
import { cn } from '@/lib/utils';
import { tableScrollRef } from '@/components/ScrollButtons';

interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollableTable = ({ children, className }: ScrollableTableProps) => {
  return (
    <div className="relative">
      <div
        ref={(node) => {
          if (node) {
            tableScrollRef.current = node;
          }
        }}
        className={cn("overflow-x-auto", className)}
        data-scrollable-table="true"
      >
        {children}
      </div>
    </div>
  );
};
