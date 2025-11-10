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

    // Sync sticky scrollbar width with main content
    const updateStickyWidth = () => {
      stickyScrollContent.style.width = `${mainScroll.scrollWidth}px`;
      setShowStickyScroll(mainScroll.scrollWidth > mainScroll.clientWidth);
    };

    // Sync scroll positions
    const syncMainToSticky = () => {
      if (stickyScroll.scrollLeft !== mainScroll.scrollLeft) {
        stickyScroll.scrollLeft = mainScroll.scrollLeft;
      }
    };

    const syncStickyToMain = () => {
      if (mainScroll.scrollLeft !== stickyScroll.scrollLeft) {
        mainScroll.scrollLeft = stickyScroll.scrollLeft;
      }
    };

    // Check if sticky scrollbar should be visible
    const checkVisibility = () => {
      const rect = mainScroll.getBoundingClientRect();
      const isMainScrollbarVisible = rect.bottom > window.innerHeight;
      setShowStickyScroll(isMainScrollbarVisible && mainScroll.scrollWidth > mainScroll.clientWidth);
    };

    mainScroll.addEventListener('scroll', syncMainToSticky);
    stickyScroll.addEventListener('scroll', syncStickyToMain);
    
    // Initial setup and updates
    updateStickyWidth();
    checkVisibility();
    
    const resizeObserver = new ResizeObserver(() => {
      updateStickyWidth();
      checkVisibility();
    });
    
    resizeObserver.observe(mainScroll);
    window.addEventListener('scroll', checkVisibility);
    window.addEventListener('resize', checkVisibility);

    return () => {
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
          className={cn("overflow-x-auto", className)}
          data-scrollable-table="true"
          style={{ maxWidth: '100%' }}
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
