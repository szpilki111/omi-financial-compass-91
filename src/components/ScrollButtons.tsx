import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const ScrollButtons = () => {
  const scrollAmount = 300;

  const getScrollableElement = () => {
    return document.querySelector('[data-scrollable-table="true"]') as HTMLElement;
  };

  const handleScrollLeft = () => {
    const element = getScrollableElement();
    console.log("Scroll left clicked, element:", element);
    if (element) {
      element.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    const element = getScrollableElement();
    console.log("Scroll right clicked, element:", element);
    if (element) {
      element.scrollBy({ left: scrollAmount, behavior: "smooth" });
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
