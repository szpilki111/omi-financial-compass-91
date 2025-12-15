import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";
import { ErrorReportDialog } from "./ErrorReportDialog";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";

export const ErrorReportButton = () => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureScreenshot = async () => {
    setIsCapturing(true);
    console.log("Starting screenshot capture...");
    try {
      console.log("Window dimensions:", { 
        innerWidth: window.innerWidth, 
        innerHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      });
      
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: true, // Enable html2canvas logging for debugging
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        scale: 1, // Use scale 1 for better performance
        ignoreElements: (element) => {
          // Ignore problematic elements that might cause issues
          return element.classList?.contains('error-report-button-ignore');
        }
      });
      
      console.log("Canvas created:", { width: canvas.width, height: canvas.height });
      const dataUrl = canvas.toDataURL("image/png");
      console.log("Screenshot data URL length:", dataUrl.length);
      
      if (dataUrl && dataUrl.length > 100) {
        setScreenshot(dataUrl);
        console.log("Screenshot captured successfully");
      } else {
        console.error("Screenshot data URL is too short or empty");
        setScreenshot(null);
      }
      setDialogOpen(true);
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zrobić screenshota, ale możesz zgłosić błąd bez niego.",
        variant: "destructive",
      });
      setScreenshot(null);
      setDialogOpen(true);
    } finally {
      setIsCapturing(false);
    }
  };

  const getBrowserInfo = () => {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  };

  return (
    <>
      <Button
        onClick={captureScreenshot}
        disabled={isCapturing}
        className="fixed bottom-6 right-6 z-50 shadow-lg mb-20"
        size="lg"
        title="Zgłoś błąd"
      >
        <Bug className="h-5 w-5 mr-2" />
        {isCapturing ? "Robię screenshot..." : "Zgłoś błąd"}
      </Button>

      <ErrorReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        autoScreenshot={screenshot}
        pageUrl={window.location.href}
        browserInfo={getBrowserInfo()}
      />
    </>
  );
};
