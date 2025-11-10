import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const tableScrollRef = useRef<HTMLDivElement>(null);

export const ScrollButtons = () => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollAmount = 300;

  const updateScrollState = () => {
    if (tableScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    updateScrollState();
    const handleScroll = () => updateScrollState();
    const scrollableDiv = tableScrollRef.current;
    if (scrollableDiv) {
      scrollableDiv.addEventListener("scroll", handleScroll);
      window.addEventListener("resize", handleScroll);
      return () => {
        scrollableDiv.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      };
    }
  }, []);

  const scrollLeft = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <>
      <Button
        onClick={scrollLeft}
        disabled={!canScrollLeft}
        className="fixed left-6 top-1/2 transform -translate-y-1/2 z-50 shadow-lg rounded-full"
        size="lg"
        title="Przewiń w lewo"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        onClick={scrollRight}
        disabled={!canScrollRight}
        className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 shadow-lg rounded-full"
        size="lg"
        title="Przewiń w prawo"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </>
  );
};
