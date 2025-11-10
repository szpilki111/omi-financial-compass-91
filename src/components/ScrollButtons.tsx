import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const tableScrollRef: { current: HTMLDivElement | null } = { current: null };

export const ScrollButtons = () => {
  const scrollAmount = 300;

  useEffect(() => {
    // Odczekaj na zamontowanie DOM i sprawdź ref
    const timer = setTimeout(() => {
      if (tableScrollRef.current) {
        console.log("ScrollableTable ref is attached:", tableScrollRef.current);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleScrollLeft = () => {
    console.log("Scroll left clicked, ref:", tableScrollRef.current);
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    console.log("Scroll right clicked, ref:", tableScrollRef.current);
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <>
      <Button
        onClick={handleScrollLeft}
        className="fixed left-6 top-1/2 transform -translate-y-1/2 z-50 shadow-lg rounded-full"
        size="lg"
        title="Przewiń w lewo"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        onClick={handleScrollRight}
        className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 shadow-lg rounded-full"
        size="lg"
        title="Przewiń w prawo"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </>
  );
};
