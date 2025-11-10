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
      
      {/* Floating scrollbar in center of screen */}
      <div
        ref={stickyScrollRef}
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[80%] max-w-4xl",
          "overflow-x-auto overflow-y-hidden z-40",
          "bg-background/80 backdrop-blur-md",
          "border border-border/50 rounded-full shadow-2xl",
          "px-4 py-2",
          !isScrollable && "opacity-30 pointer-events-none"
        )}
        style={{ height: '20px' }}
      >
        <div ref={stickyScrollContentRef} style={{ height: '1px' }} />
      </div>
    </>
  );
};
