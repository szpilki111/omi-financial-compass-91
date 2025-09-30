import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Loader2 } from "lucide-react";

interface ErrorReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoScreenshot: string | null;
  pageUrl: string;
  browserInfo: any;
}

export const ErrorReportDialog = ({
  open,
  onOpenChange,
  autoScreenshot,
  pageUrl,
  browserInfo,
}: ErrorReportDialogProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles([...additionalFiles, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setAdditionalFiles(additionalFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const userId = user.id;
      const timestamp = Date.now();
      let screenshotUrl = null;
      const additionalFileUrls: string[] = [];

      // Upload auto screenshot if exists
      if (autoScreenshot) {
        const blob = await (await fetch(autoScreenshot)).blob();
        const screenshotPath = `${userId}/${timestamp}_auto_screenshot.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("error-reports")
          .upload(screenshotPath, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("error-reports")
          .getPublicUrl(screenshotPath);
        
        screenshotUrl = publicUrl;
      }

      // Upload additional files
      for (let i = 0; i < additionalFiles.length; i++) {
        const file = additionalFiles[i];
        const filePath = `${userId}/${timestamp}_${i}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("error-reports")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("error-reports")
          .getPublicUrl(filePath);
        
        additionalFileUrls.push(publicUrl);
      }

      // Create error report
      const { error: insertError } = await supabase
        .from("error_reports")
        .insert({
          user_id: userId,
          title,
          description,
          page_url: pageUrl,
          browser_info: browserInfo,
          screenshot_url: screenshotUrl,
          additional_files: additionalFileUrls,
          priority,
          status: "new",
        });

      if (insertError) throw insertError;

      // Create notification for admins
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "prowincjal"]);

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: "Nowe zgłoszenie błędu",
          message: `${title} (priorytet: ${priority})`,
          priority: priority === "critical" || priority === "high" ? "high" : "medium",
          action_link: "/administracja?tab=error-reports",
          action_label: "Zobacz zgłoszenie",
        }));

        await supabase.from("notifications").insert(notifications);
      }

      toast({
        title: "Zgłoszenie wysłane",
        description: "Twoje zgłoszenie błędu zostało przesłane do administratorów.",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAdditionalFiles([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zgłoś błąd</DialogTitle>
          <DialogDescription>
            Opisz napotkany problem. Automatyczny screenshot został już załączony.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tytuł problemu *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Krótki opis problemu"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Szczegółowy opis *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opisz dokładnie co się stało, jakie kroki doprowadziły do błędu..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priorytet</Label>
            <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niski</SelectItem>
                <SelectItem value="medium">Średni</SelectItem>
                <SelectItem value="high">Wysoki</SelectItem>
                <SelectItem value="critical">Krytyczny</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {autoScreenshot && (
            <div className="space-y-2">
              <Label>Automatyczny screenshot</Label>
              <div className="border rounded-lg p-2">
                <img src={autoScreenshot} alt="Screenshot" className="max-h-40 mx-auto" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="files">Dodatkowe pliki (opcjonalne)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Input
                id="files"
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <label htmlFor="files" className="cursor-pointer">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Kliknij aby dodać pliki lub przeciągnij je tutaj
                </p>
              </label>
            </div>

            {additionalFiles.length > 0 && (
              <div className="space-y-2">
                {additionalFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Wyślij zgłoszenie
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
