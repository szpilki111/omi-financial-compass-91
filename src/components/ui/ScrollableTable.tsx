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

    // Check if sticky scrollbar should be visible
    const checkVisibility = () => {
      const rect = mainScroll.getBoundingClientRect();
      const isMainScrollbarVisible = rect.bottom > window.innerHeight;
      setShowStickyScroll(isMainScrollbarVisible && mainScroll.scrollWidth > mainScroll.clientWidth);
    };

    mainScroll.addEventListener('scroll', syncMainToSticky, { passive: true });
    stickyScroll.addEventListener('scroll', syncStickyToMain, { passive: true });
    
    // Initial setup and updates
    updateStickyWidth();
    checkVisibility();
    
    const resizeObserver = new ResizeObserver(() => {
      updateStickyWidth();
      checkVisibility();
    });
    
    resizeObserver.observe(mainScroll);
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      mainScroll.removeEventListener('scroll', syncMainToSticky);
      stickyScroll.removeEventListener('scroll', syncStickyToMain);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
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
      
      {/* Sticky scrollbar at bottom of screen */}
      {showStickyScroll && (
        <div
          ref={stickyScrollRef}
          className="fixed bottom-0 left-0 right-0 overflow-x-auto overflow-y-hidden z-40 bg-background border-t border-border"
          style={{ height: '20px' }}
        >
          <div ref={stickyScrollContentRef} style={{ height: '1px' }} />
        </div>
      )}
    </>
  );
};
