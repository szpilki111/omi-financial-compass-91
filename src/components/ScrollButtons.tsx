import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ScrollButtons = () => {
  const { toast } = useToast();
  const scrollAmount = 300;

  const getScrollableElement = () => {
    const element = document.querySelector('[data-scrollable-table="true"]') as HTMLElement;
    if (!element) {
      console.error("Scrollable table element not found");
      toast({
        title: "Błąd",
        description: "Nie znaleziono przewijanego elementu tabeli.",
        variant: "destructive",
      });
    }
    return element;
  };

  const handleScrollLeft = () => {
    const element = getScrollableElement();
    console.log("Scroll left clicked, element:", element);
    if (element) {
      console.log("Scrolling left, current scrollLeft:", element.scrollLeft);
      element.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    const element = getScrollableElement();
    console.log("Scroll right clicked, element:", element);
    if (element) {
      console.log("Scrolling right, current scrollLeft:", element.scrollLeft);
      element.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Debug scrollable element on mount
  useEffect(() => {
    setTimeout(() => {
      const element = getScrollableElement();
      console.log("Scrollable element on mount:", element);
      if (element) {
        console.log("Element scroll properties:", {
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollLeft: element.scrollLeft,
          isScrollable: element.scrollWidth > element.clientWidth,
        });
      }
    }, 150);
  }, []);

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
