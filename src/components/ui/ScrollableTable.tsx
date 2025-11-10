import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollableTable = ({ children, className }: ScrollableTableProps) => {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);
  const stickyScrollContentRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [fontSize, setFontSize] = useState(100); // percentage

  useEffect(() => {
    const mainScroll = mainScrollRef.current;
    const stickyScroll = stickyScrollRef.current;
    const stickyScrollContent = stickyScrollContentRef.current;

    if (!mainScroll || !stickyScroll || !stickyScrollContent) return;

    let rafId: number | null = null;
    let isMainScrolling = false;
    let isStickyScrolling = false;

    // Sync sticky scrollbar width with main content
    const updateStickyWidth = () => {
      stickyScrollContent.style.width = `${mainScroll.scrollWidth}px`;
      setIsScrollable(mainScroll.scrollWidth > mainScroll.clientWidth);
    };

    // Continuous sync during smooth scrolling
    const continuousSync = () => {
      if (isMainScrolling && stickyScroll.scrollLeft !== mainScroll.scrollLeft) {
        stickyScroll.scrollLeft = mainScroll.scrollLeft;
        rafId = requestAnimationFrame(continuousSync);
      } else if (isStickyScrolling && mainScroll.scrollLeft !== stickyScroll.scrollLeft) {
        mainScroll.scrollLeft = stickyScroll.scrollLeft;
        rafId = requestAnimationFrame(continuousSync);
      }
    };

    // Sync scroll positions
    const syncMainToSticky = () => {
      if (!isStickyScrolling) {
        isMainScrolling = true;
        if (stickyScroll.scrollLeft !== mainScroll.scrollLeft) {
          stickyScroll.scrollLeft = mainScroll.scrollLeft;
        }
        if (rafId === null) {
          rafId = requestAnimationFrame(continuousSync);
        }
        setTimeout(() => {
          isMainScrolling = false;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        }, 100);
      }
    };

    const syncStickyToMain = () => {
      if (!isMainScrolling) {
        isStickyScrolling = true;
        if (mainScroll.scrollLeft !== stickyScroll.scrollLeft) {
          mainScroll.scrollLeft = stickyScroll.scrollLeft;
        }
        if (rafId === null) {
          rafId = requestAnimationFrame(continuousSync);
        }
        setTimeout(() => {
          isStickyScrolling = false;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        }, 100);
      }
    };

    // Check if table is scrollable
    const checkScrollability = () => {
      setIsScrollable(mainScroll.scrollWidth > mainScroll.clientWidth);
    };

    // Auto-scale font size to fit table on screen
    const adjustFontSize = () => {
      const availableHeight = window.innerHeight - 280; // Same as maxHeight calc
      const tableHeight = mainScroll.scrollHeight;
      
      if (tableHeight > availableHeight) {
        // Calculate optimal font size to fit content
        const ratio = availableHeight / tableHeight;
        const newFontSize = Math.max(60, Math.min(100, Math.floor(ratio * 100)));
        setFontSize(newFontSize);
      } else {
        setFontSize(100); // Reset to 100% if it fits
      }
    };

    mainScroll.addEventListener('scroll', syncMainToSticky, { passive: true });
    stickyScroll.addEventListener('scroll', syncStickyToMain, { passive: true });
    
    // Initial setup and updates
    updateStickyWidth();
    checkScrollability();
    adjustFontSize();
    
    const resizeObserver = new ResizeObserver(() => {
      updateStickyWidth();
      checkScrollability();
      adjustFontSize();
    });
    
    resizeObserver.observe(mainScroll);
    window.addEventListener('resize', () => {
      checkScrollability();
      adjustFontSize();
    }, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      mainScroll.removeEventListener('scroll', syncMainToSticky);
      stickyScroll.removeEventListener('scroll', syncStickyToMain);
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScrollability);
    };
  }, []);

  return (
    <>
      <div className="relative">
        <div
          ref={mainScrollRef}
          className={cn("overflow-auto", className)}
          data-scrollable-table="true"
          style={{ 
            maxWidth: '50%',
            maxHeight: 'calc(100vh - 280px)',
            fontSize: `${fontSize}%`,
            transition: 'font-size 0.2s ease-in-out'
          }}
        >
          {children}
        </div>
      </div>
      
      {/* Fixed sticky scrollbar always visible at bottom */}
      <div
        ref={stickyScrollRef}
        className={cn(
          "fixed left-6 right-6 bottom-4 overflow-x-auto overflow-y-hidden z-[100]",
          "bg-background/90 backdrop-blur-md",
          "border border-border/50 rounded-lg shadow-lg",
          "px-4 py-2",
          "transition-opacity duration-200",
          "hover:opacity-100 hover:shadow-xl",
          isScrollable ? "opacity-90" : "opacity-0 pointer-events-none"
        )}
        style={{ height: '20px' }}
      >
        <div ref={stickyScrollContentRef} style={{ height: '12px' }} />
      </div>
    </>
  );
};
