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
  const [scrollbarPosition, setScrollbarPosition] = useState<'hidden' | 'bottom' | 'floating'>('bottom');
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Handle scroll activity - show floating scrollbar
    const handleScrollActivity = () => {
      if (!isScrollable) return;
      
      setScrollbarPosition('floating');
      
      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // Auto-hide after 3 seconds of inactivity
      hideTimeoutRef.current = setTimeout(() => {
        setScrollbarPosition('bottom');
      }, 3000);
    };

    // Handle mouse movement over table - show scrollbar
    const handleMouseMove = () => {
      if (!isScrollable) return;
      handleScrollActivity();
    };

    mainScroll.addEventListener('scroll', syncMainToSticky, { passive: true });
    stickyScroll.addEventListener('scroll', syncStickyToMain, { passive: true });
    mainScroll.addEventListener('scroll', handleScrollActivity, { passive: true });
    mainScroll.addEventListener('mousemove', handleMouseMove, { passive: true });
    
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
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      mainScroll.removeEventListener('scroll', syncMainToSticky);
      stickyScroll.removeEventListener('scroll', syncStickyToMain);
      mainScroll.removeEventListener('scroll', handleScrollActivity);
      mainScroll.removeEventListener('mousemove', handleMouseMove);
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
      
      {/* Hybrid floating scrollbar with auto-hide */}
      <div
        ref={stickyScrollRef}
        className={cn(
          "fixed left-6 right-6 overflow-x-auto overflow-y-hidden z-[100]",
          "bg-background/90 backdrop-blur-md",
          "border border-border/50 rounded-full shadow-2xl",
          "px-4 py-2",
          "transition-all duration-300 ease-in-out",
          "hover:opacity-100 hover:shadow-xl",
          scrollbarPosition === 'hidden' && "opacity-0 translate-y-4 pointer-events-none",
          scrollbarPosition === 'bottom' && "bottom-4 opacity-70",
          scrollbarPosition === 'floating' && "bottom-[35%] md:bottom-[40%] opacity-100 shadow-2xl",
          !isScrollable && "opacity-30 pointer-events-none"
        )}
        style={{ height: '20px' }}
        onMouseEnter={() => isScrollable && setScrollbarPosition('floating')}
      >
        <div ref={stickyScrollContentRef} style={{ height: '12px' }} />
      </div>
    </>
  );
};
