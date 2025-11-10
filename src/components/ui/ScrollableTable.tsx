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
  const [showStickyScroll, setShowStickyScroll] = useState(false);

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
      setShowStickyScroll(mainScroll.scrollWidth > mainScroll.clientWidth);
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

    // Check if table is scrollable (always show sticky scrollbar when scrollable)
    const checkScrollability = () => {
      const isScrollable = mainScroll.scrollWidth > mainScroll.clientWidth;
      setShowStickyScroll(isScrollable);
    };

    mainScroll.addEventListener('scroll', syncMainToSticky, { passive: true });
    stickyScroll.addEventListener('scroll', syncStickyToMain, { passive: true });
    
    // Initial setup and updates
    updateStickyWidth();
    checkScrollability();
    
    const resizeObserver = new ResizeObserver(() => {
      updateStickyWidth();
      checkScrollability();
    });
    
    resizeObserver.observe(mainScroll);
    window.addEventListener('resize', checkScrollability, { passive: true });

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
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 280px)'
          }}
        >
          {children}
        </div>
      </div>
      
      {/* Sticky scrollbar at bottom of viewport */}
      {showStickyScroll && (
        <div
          ref={stickyScrollRef}
          className="fixed bottom-0 left-0 right-0 overflow-x-auto overflow-y-hidden z-40 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg"
          style={{ height: '16px' }}
        >
          <div ref={stickyScrollContentRef} style={{ height: '1px' }} />
        </div>
      )}
    </>
  );
};
