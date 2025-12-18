import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/Spinner';
import { Bell, Send, Calendar, CheckCircle, Building2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PendingLocation {
  id: string;
  name: string;
  economists: { email: string; name: string }[];
}

const RemindersManagement: React.FC = () => {
  const [isSending, setIsSending] = useState(false);
  const [sendingLocationId, setSendingLocationId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: reminderLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['reminderLogs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_logs')
        .select(`
          *,
          locations (name)
        `)
        .order('sent_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['pendingReminders'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-report-reminders', {
        body: { list_only: true }
      });
      
      if (error) throw error;
      return data as { 
        pendingLocations: PendingLocation[]; 
        reportMonth: number; 
        reportYear: number;
        reminderType: string;
      };
    }
  });

  const handleSendReminders = async () => {
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-report-reminders');
      
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Nieznany błąd');

      const sent = data?.sent || 0;
      const remaining = data?.remaining || 0;

      toast({
        title: sent > 0 ? "Przypomnienia wysłane" : "Informacja",
        description: data?.message || `Wysłano ${sent} przypomnień.`,
      });

      refetchLogs();
      refetchPending();
    } catch (error: any) {
      console.error('Error sending reminders:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wysłać przypomnień.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSingleReminder = async (locationId: string, locationName: string) => {
    setSendingLocationId(locationId);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-report-reminders', {
        body: { location_id: locationId, force_send: true }
      });
      
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Nieznany błąd');

      toast({
        title: "Przypomnienie wysłane",
        description: data?.message || `Wysłano przypomnienie dla: ${locationName}`,
      });

      refetchLogs();
      refetchPending();
    } catch (error: any) {
      console.error('Error sending single reminder:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wysłać przypomnienia.",
        variant: "destructive",
      });
    } finally {
      setSendingLocationId(null);
    }
  };

  const getReminderTypeBadge = (type: string) => {
    switch (type) {
      case 'overdue':
        return <Badge variant="destructive">Po terminie</Badge>;
      case '1_day':
        return <Badge variant="default" className="bg-orange-500">1 dzień</Badge>;
      case '5_days':
        return <Badge variant="secondary">5 dni</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const pendingLocations = pendingData?.pendingLocations || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Automatyczne przypomnienia
          </CardTitle>
          <CardDescription>
            Wysyłaj przypomnienia o terminach raportów do ekonomów placówek
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Przypomnienia o raportach</p>
              <p className="text-sm text-muted-foreground">
                Wyślij przypomnienia zbiorczo (max 5 na raz) lub pojedynczo dla wybranej placówki.
              </p>
            </div>
            <Button 
              onClick={handleSendReminders} 
              disabled={isSending || pendingLocations.length === 0}
              className="flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Spinner size="sm" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Wyślij wszystkie
                </>
              )}
            </Button>
          </div>

          {/* Pending locations section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Placówki oczekujące na przypomnienie
                {pendingData?.reportMonth && (
                  <Badge variant="outline" className="ml-2">
                    {pendingData.reportMonth}/{pendingData.reportYear}
                  </Badge>
                )}
              </h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetchPending()}
                disabled={pendingLoading}
              >
                <RefreshCw className={`h-4 w-4 ${pendingLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {pendingLoading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : pendingLocations.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placówka</TableHead>
                      <TableHead>Ekonomiści</TableHead>
                      <TableHead className="w-[100px]">Akcja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLocations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {loc.economists.length > 0 
                            ? loc.economists.map(e => e.name || e.email).join(', ')
                            : <span className="italic">Brak przypisanego ekonoma</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendSingleReminder(loc.id, loc.name)}
                            disabled={sendingLocationId === loc.id || loc.economists.length === 0}
                          >
                            {sendingLocationId === loc.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Wszystkie placówki złożyły raporty
              </p>
            )}
          </div>

          {/* History section */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Historia wysłanych przypomnień
            </h4>
            
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : reminderLogs && reminderLogs.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data wysłania</TableHead>
                      <TableHead>Placówka</TableHead>
                      <TableHead>Okres</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Odbiorca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminderLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.sent_at ? format(new Date(log.sent_at), 'dd.MM.yyyy HH:mm', { locale: pl }) : '-'}
                        </TableCell>
                        <TableCell>{(log.locations as any)?.name || 'Nieznana'}</TableCell>
                        <TableCell>{log.month}/{log.year}</TableCell>
                        <TableCell>{getReminderTypeBadge(log.reminder_type)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.recipient_email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Brak wysłanych przypomnień
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RemindersManagement;
