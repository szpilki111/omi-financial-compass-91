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
    try {
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
      });
      const dataUrl = canvas.toDataURL("image/png");
      setScreenshot(dataUrl);
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
