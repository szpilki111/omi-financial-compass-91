import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollableTable = ({ children, className }: ScrollableTableProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn("overflow-x-auto", className)}
      >
        {children}
      </div>

      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-muted/95 backdrop-blur-sm border-2 border-border rounded-full p-3 shadow-2xl hover:bg-muted hover:scale-110 transition-all duration-200"
          aria-label="Przewiń w lewo"
        >
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
      )}
      
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-muted/95 backdrop-blur-sm border-2 border-border rounded-full p-3 shadow-2xl hover:bg-muted hover:scale-110 transition-all duration-200"
          aria-label="Przewiń w prawo"
        >
          <ChevronRight className="h-6 w-6 text-foreground" />
        </button>
      )}
    </div>
  );
};
