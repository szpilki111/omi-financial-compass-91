import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eye, ExternalLink, Paperclip, X } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState as useComponentState } from "react";

const ResponseAttachments = ({ paths }: { paths: string[] }) => {
  const [urls, setUrls] = useComponentState<string[]>([]);

  useEffect(() => {
    const loadUrls = async () => {
      const signedUrls = await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage
            .from("error-reports")
            .createSignedUrl(path, 3600);
          return data?.signedUrl || "";
        })
      );
      setUrls(signedUrls.filter(url => url !== ""));
    };
    loadUrls();
  }, [paths]);

  if (urls.length === 0) return null;

  return (
    <div className="space-y-1 pt-2">
      <Label className="text-xs">Załączniki:</Label>
      {urls.map((url, idx) => (
        <a
          key={idx}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline block"
        >
          Załącznik {idx + 1}
        </a>
      ))}
    </div>
  );
};

type ErrorReport = {
  id: string;
  title: string;
  description: string;
  page_url: string;
  browser_info: any;
  screenshot_url: string | null;
  additional_files: string[] | null;
  status: "new" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: {
    name: string;
    email: string;
  } | null;
};

type ErrorReportResponse = {
  id: string;
  error_report_id: string;
  user_id: string;
  message: string;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
  profiles: {
    name: string;
    email: string;
  } | null;
};

const ErrorReportsManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminResponse, setAdminResponse] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "in_progress" | "resolved" | "closed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [newResponse, setNewResponse] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["error-reports", statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from("error_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }

      const { data: errorReports, error } = await query;
      if (error) throw error;

      // Fetch user profiles separately
      if (errorReports && errorReports.length > 0) {
        const userIds = [...new Set(errorReports.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        return errorReports.map(report => ({
          ...report,
          profiles: profilesMap.get(report.user_id) || null,
        })) as ErrorReport[];
      }

      return [] as ErrorReport[];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["error-report-responses", selectedReport?.id],
    queryFn: async () => {
      if (!selectedReport?.id) return [];
      
      const { data: responsesData, error } = await supabase
        .from("error_report_responses")
        .select("*")
        .eq("error_report_id", selectedReport.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch user profiles separately
      if (responsesData && responsesData.length > 0) {
        const userIds = [...new Set(responsesData.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        return responsesData.map(response => ({
          ...response,
          profiles: profilesMap.get(response.user_id) || null,
        })) as ErrorReportResponse[];
      }

      return [] as ErrorReportResponse[];
    },
    enabled: !!selectedReport?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "new" | "in_progress" | "resolved" | "closed";
    }) => {
      const { error } = await supabase
        .from("error_reports")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-reports"] });
      toast({
        title: "Zaktualizowano",
        description: "Status zgłoszenia został zaktualizowany.",
      });
    },
    onError: (error) => {
      console.error("Error updating report:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować zgłoszenia.",
        variant: "destructive",
      });
    },
  });

  const addResponseMutation = useMutation({
    mutationFn: async ({
      errorReportId,
      message,
      attachments,
    }: {
      errorReportId: string;
      message: string;
      attachments: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("error_report_responses")
        .insert({
          error_report_id: errorReportId,
          user_id: user.id,
          message,
          attachments: attachments.length > 0 ? attachments : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-report-responses", selectedReport?.id] });
      setNewResponse("");
      setUploadedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast({
        title: "Sukces",
        description: "Odpowiedź została dodana.",
      });
    },
    onError: (error) => {
      console.error("Error adding response:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się dodać odpowiedzi.",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = async (report: ErrorReport) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setAdminResponse(report.admin_response || "");
    
    // Generate signed URLs for screenshot and files
    if (report.screenshot_url) {
      const { data } = await supabase.storage
        .from("error-reports")
        .createSignedUrl(report.screenshot_url, 3600); // 1 hour expiry
      setScreenshotUrl(data?.signedUrl || null);
    } else {
      setScreenshotUrl(null);
    }

    if (report.additional_files && report.additional_files.length > 0) {
      const urls = await Promise.all(
        report.additional_files.map(async (path) => {
          const { data } = await supabase.storage
            .from("error-reports")
            .createSignedUrl(path, 3600);
          return data?.signedUrl || "";
        })
      );
      setFileUrls(urls.filter(url => url !== ""));
    } else {
      setFileUrls([]);
    }
    
    setDetailsOpen(true);
  };

  const handleAddResponse = async () => {
    if (!selectedReport || !newResponse.trim()) return;

    const attachmentUrls: string[] = [];

    // Upload files if any
    for (const file of uploadedFiles) {
      const filePath = `${selectedReport.id}/responses/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("error-reports")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        toast({
          title: "Błąd",
          description: `Nie udało się przesłać pliku: ${file.name}`,
          variant: "destructive",
        });
        return;
      }

      attachmentUrls.push(filePath);
    }

    addResponseMutation.mutate({
      errorReportId: selectedReport.id,
      message: newResponse,
      attachments: attachmentUrls,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      new: "destructive",
      in_progress: "default",
      resolved: "secondary",
      closed: "outline",
    };
    const labels: Record<string, string> = {
      new: "Nowe",
      in_progress: "W trakcie",
      resolved: "Rozwiązane",
      closed: "Zamknięte",
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "default",
      critical: "destructive",
    };
    const labels: Record<string, string> = {
      low: "Niski",
      medium: "Średni",
      high: "Wysoki",
      critical: "Krytyczny",
    };
    return <Badge variant={variants[priority]}>{labels[priority]}</Badge>;
  };

  if (isLoading) {
    return <div className="p-8">Ładowanie zgłoszeń...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="new">Nowe</SelectItem>
              <SelectItem value="in_progress">W trakcie</SelectItem>
              <SelectItem value="resolved">Rozwiązane</SelectItem>
              <SelectItem value="closed">Zamknięte</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <Label>Priorytet</Label>
          <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="low">Niski</SelectItem>
              <SelectItem value="medium">Średni</SelectItem>
              <SelectItem value="high">Wysoki</SelectItem>
              <SelectItem value="critical">Krytyczny</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Użytkownik</TableHead>
              <TableHead>Tytuł</TableHead>
              <TableHead>Priorytet</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports?.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  {format(new Date(report.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{report.profiles?.name || "Nieznany"}</div>
                    <div className="text-sm text-muted-foreground">{report.profiles?.email || ""}</div>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate">{report.title}</TableCell>
                <TableCell>{getPriorityBadge(report.priority)}</TableCell>
                <TableCell>{getStatusBadge(report.status)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(report)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Szczegóły zgłoszenia</DialogTitle>
            <DialogDescription>
              Zgłoszone przez {selectedReport?.profiles.name} dnia{" "}
              {selectedReport &&
                format(new Date(selectedReport.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priorytet</Label>
                  <div className="mt-1">{getPriorityBadge(selectedReport.priority)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={newStatus} 
                    onValueChange={(value: "new" | "in_progress" | "resolved" | "closed") => {
                      setNewStatus(value);
                      updateMutation.mutate({
                        id: selectedReport.id,
                        status: value,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nowe</SelectItem>
                      <SelectItem value="in_progress">W trakcie</SelectItem>
                      <SelectItem value="resolved">Rozwiązane</SelectItem>
                      <SelectItem value="closed">Zamknięte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Strona</Label>
                <a
                  href={selectedReport.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  {selectedReport.page_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Conversation Thread */}
              <div className="space-y-2">
                <Label>Konwersacja</Label>
                <ScrollArea className="h-[400px] border rounded-md p-4">
                  <div className="space-y-4">
                    {/* Initial report */}
                    <div className="space-y-2 pb-4 border-b">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">{selectedReport.profiles?.name || "Nieznany użytkownik"}</span>
                        <span>{format(new Date(selectedReport.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{selectedReport.description}</p>
                      {screenshotUrl && (
                        <img src={screenshotUrl} alt="Screenshot" className="max-w-full rounded border" />
                      )}
                      {fileUrls.length > 0 && (
                        <div className="space-y-1 pt-2">
                          <Label className="text-xs">Załączniki:</Label>
                          {fileUrls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline block"
                            >
                              Plik {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Responses */}
                    {responses?.map((response) => (
                      <div key={response.id} className="space-y-2 pt-4 pb-4 border-b last:border-b-0">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">{response.profiles?.name || "Nieznany użytkownik"}</span>
                          <span>{format(new Date(response.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{response.message}</p>
                        {response.attachments && response.attachments.length > 0 && (
                          <ResponseAttachments paths={response.attachments} />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Add new response */}
              <div className="space-y-2">
                <Label>Dodaj odpowiedź</Label>
                <Textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  rows={3}
                  placeholder="Wprowadź odpowiedź..."
                />
                
                <div className="space-y-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Dodaj pliki
                  </Button>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 truncate">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleAddResponse} 
                  disabled={addResponseMutation.isPending || !newResponse.trim()}
                >
                  {addResponseMutation.isPending ? "Wysyłanie..." : "Dodaj odpowiedź"}
                </Button>
              </div>

              <div>
                <Label>Informacje o przeglądarce</Label>
                <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedReport.browser_info, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErrorReportsManagement;
