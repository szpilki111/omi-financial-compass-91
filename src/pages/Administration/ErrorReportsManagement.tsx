import { useState, useEffect } from "react";
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
import { Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

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
  profiles: {
    name: string;
    email: string;
  };
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

      const { data: reportsData, error } = await query;

      if (error) throw error;

      // Fetch user profiles separately
      if (reportsData && reportsData.length > 0) {
        const userIds = [...new Set(reportsData.map((r: any) => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        // Map profiles to reports
        return reportsData.map((report: any) => ({
          ...report,
          profiles: profilesData?.find((p) => p.id === report.user_id) || {
            name: "Unknown",
            email: "unknown@example.com",
          },
        }));
      }

      return [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      response,
    }: {
      id: string;
      status?: string;
      response?: string;
    }) => {
      const updates: any = {};
      if (status) updates.status = status;
      if (response !== undefined) updates.admin_response = response;

      const { error } = await supabase
        .from("error_reports")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-reports"] });
      toast({
        title: "Zaktualizowano",
        description: "Zgłoszenie zostało zaktualizowane.",
      });
      setDetailsOpen(false);
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

  const handleUpdate = () => {
    if (selectedReport) {
      updateMutation.mutate({
        id: selectedReport.id,
        status: newStatus,
        response: adminResponse,
      });
    }
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
                    <div className="font-medium">{report.profiles.name}</div>
                    <div className="text-sm text-muted-foreground">{report.profiles.email}</div>
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
              <div>
                <Label>Tytuł</Label>
                <p className="text-sm mt-1">{selectedReport.title}</p>
              </div>

              <div>
                <Label>Opis</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priorytet</Label>
                  <div className="mt-1">{getPriorityBadge(selectedReport.priority)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
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

              {screenshotUrl && (
                <div>
                  <Label>Screenshot</Label>
                  <img
                    src={screenshotUrl}
                    alt="Screenshot"
                    className="mt-2 border rounded-lg max-w-full"
                  />
                </div>
              )}

              {fileUrls.length > 0 && (
                <div>
                  <Label>Dodatkowe pliki</Label>
                  <div className="space-y-2 mt-2">
                    {fileUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary hover:underline"
                      >
                        Plik {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Informacje o przeglądarce</Label>
                <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedReport.browser_info, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <Label>Zmień status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
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

              <div className="space-y-2">
                <Label>Odpowiedź administratora</Label>
                <Textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Opcjonalna odpowiedź do użytkownika..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Anuluj
                </Button>
                <Button onClick={handleUpdate}>Zapisz zmiany</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErrorReportsManagement;
