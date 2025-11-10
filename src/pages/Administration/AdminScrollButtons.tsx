import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AdminScrollButtons = () => {
  const [showLeftButton, setShowLeftButton] = useState(false);
  const [showRightButton, setShowRightButton] = useState(false);

  const checkScroll = () => {
    const scrollableElement = document.querySelector('[data-scrollable-table="true"]') as HTMLElement;
    if (scrollableElement) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollableElement;
      setShowLeftButton(scrollLeft > 0);
      setShowRightButton(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    
    const scrollableElement = document.querySelector('[data-scrollable-table="true"]');
    if (scrollableElement) {
      scrollableElement.addEventListener('scroll', checkScroll);
    }
    
    window.addEventListener('resize', checkScroll);
    
    // Check scroll when tab changes
    const observer = new MutationObserver(checkScroll);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      if (scrollableElement) {
        scrollableElement.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
      observer.disconnect();
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const scrollableElement = document.querySelector('[data-scrollable-table="true"]') as HTMLElement;
    if (scrollableElement) {
      const scrollAmount = 300;
      scrollableElement.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      {showLeftButton && (
        <Button
          onClick={() => scroll('left')}
          size="lg"
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 rounded-full p-4 shadow-2xl"
          aria-label="Przewiń w lewo"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}
      
      {showRightButton && (
        <Button
          onClick={() => scroll('right')}
          size="lg"
          className="fixed right-4 top-1/2 -translate-y-1/2 z-50 rounded-full p-4 shadow-2xl"
          aria-label="Przewiń w prawo"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}
    </>
  );
};
