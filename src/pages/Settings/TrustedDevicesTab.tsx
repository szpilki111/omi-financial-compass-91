import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Smartphone, Monitor, Info, ShieldOff } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { removeAllTrustedDevices } from '@/utils/deviceFingerprint';

interface TrustedDevice {
  id: string;
  device_fingerprint: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_used_at: string | null;
  created_at: string | null;
}

const TrustedDevicesTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);
  const [isRemovingAll, setIsRemovingAll] = useState(false);

  const { data: trustedDevices, isLoading } = useQuery({
    queryKey: ['trustedDevices', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', user?.id)
        .order('last_used_at', { ascending: false });

      if (error) throw error;
      return data as TrustedDevice[];
    },
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trustedDevices'] });
      toast({
        title: "Urządzenie usunięte",
        description: "Urządzenie zostało usunięte z listy zaufanych.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć urządzenia: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveAll = async () => {
    if (!user?.id) return;
    setIsRemovingAll(true);
    try {
      const removed = await removeAllTrustedDevices(user.id, supabase);
      queryClient.invalidateQueries({ queryKey: ['trustedDevices'] });
      setShowRemoveAllDialog(false);
      toast({
        title: "Wszystkie urządzenia usunięte",
        description: `Usunięto ${removed} zaufanych urządzeń. Przy następnym logowaniu otrzymasz kod weryfikacyjny.`,
      });
    } catch {
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć urządzeń.",
        variant: "destructive",
      });
    } finally {
      setIsRemovingAll(false);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="w-5 h-5 text-primary" />;
    if (userAgent.toLowerCase().includes('mobile') || userAgent.toLowerCase().includes('android') || userAgent.toLowerCase().includes('iphone')) {
      return <Smartphone className="w-5 h-5 text-primary" />;
    }
    return <Monitor className="w-5 h-5 text-primary" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zaufane urządzenia</CardTitle>
          <CardDescription>Ładowanie...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={showRemoveAllDialog} onOpenChange={setShowRemoveAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wszystkie zaufane urządzenia?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja usunie wszystkie zaufane urządzenia z Twojego konta. 
              Przy następnym logowaniu z każdego urządzenia będziesz musiał wprowadzić kod weryfikacyjny wysłany na email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingAll}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAll}
              disabled={isRemovingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingAll ? 'Usuwanie...' : 'Usuń wszystkie'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Zaufane urządzenia</CardTitle>
          <CardDescription>
            Zarządzaj urządzeniami, które mają dostęp do Twojego konta bez weryfikacji dwuetapowej
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              Zaufane urządzenia są zapisane <strong>na stałe</strong>. Gdy usuniesz urządzenie z listy, 
              przy następnym logowaniu z tego urządzenia otrzymasz kod weryfikacyjny na email.
            </AlertDescription>
          </Alert>

          {trustedDevices && trustedDevices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRemoveAllDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Usuń wszystkie urządzenia
              </Button>
            </div>
          )}

          {!trustedDevices || trustedDevices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nie masz żadnych zaufanych urządzeń</p>
              <p className="text-sm mt-2">
                Urządzenie zostanie automatycznie dodane do zaufanych po weryfikacji kodem przy logowaniu
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trustedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-1">
                    {getDeviceIcon(device.user_agent)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {device.device_name || 'Nieznane urządzenie'}
                    </p>
                    
                    <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                      {device.user_agent && (
                        <p className="truncate" title={device.user_agent}>
                          {device.user_agent}
                        </p>
                      )}
                      {device.ip_address && (
                        <p>IP: {device.ip_address}</p>
                      )}
                      {device.last_used_at && (
                        <p>
                          Ostatnio użyte: {format(new Date(device.last_used_at), 'PPp', { locale: pl })}
                        </p>
                      )}
                      {device.created_at && (
                        <p className="text-xs">
                          Dodane: {format(new Date(device.created_at), 'PPp', { locale: pl })}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(device.id)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrustedDevicesTab;
