import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Trash2, Smartphone, Monitor, Info, Clock, AlertTriangle, ShieldOff } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cleanupExpiredTrustedDevices, removeAllTrustedDevices } from '@/utils/deviceFingerprint';

interface TrustedDevice {
  id: string;
  device_fingerprint: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_used_at: string | null;
  created_at: string | null;
}

const TRUST_PERIOD_DAYS = 30;

const TrustedDevicesTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);
  const [isRemovingAll, setIsRemovingAll] = useState(false);
  const [isCleaningExpired, setIsCleaningExpired] = useState(false);

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

  // Auto-cleanup wygasłych urządzeń przy montowaniu komponentu
  useEffect(() => {
    const autoCleanup = async () => {
      if (user?.id) {
        const removed = await cleanupExpiredTrustedDevices(user.id, supabase);
        if (removed > 0) {
          queryClient.invalidateQueries({ queryKey: ['trustedDevices'] });
        }
      }
    };
    autoCleanup();
  }, [user?.id, queryClient]);

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

  const handleRemoveExpired = async () => {
    if (!user?.id) return;
    setIsCleaningExpired(true);
    try {
      const removed = await cleanupExpiredTrustedDevices(user.id, supabase);
      queryClient.invalidateQueries({ queryKey: ['trustedDevices'] });
      toast({
        title: removed > 0 ? "Usunięto wygasłe urządzenia" : "Brak wygasłych urządzeń",
        description: removed > 0 ? `Usunięto ${removed} wygasłych urządzeń.` : "Nie znaleziono wygasłych urządzeń do usunięcia.",
      });
    } catch {
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć wygasłych urządzeń.",
        variant: "destructive",
      });
    } finally {
      setIsCleaningExpired(false);
    }
  };

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

  const getDaysRemaining = (createdAt: string | null) => {
    if (!createdAt) return 0;
    const expiryDate = addDays(new Date(createdAt), TRUST_PERIOD_DAYS);
    return Math.max(0, differenceInDays(expiryDate, new Date()));
  };

  const getExpiryBadge = (createdAt: string | null) => {
    const daysRemaining = getDaysRemaining(createdAt);

    if (daysRemaining <= 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Wygasło
        </Badge>
      );
    }

    if (daysRemaining <= 7) {
      return (
        <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
          <Clock className="w-3 h-3" />
          Zostało {daysRemaining} dni
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="w-3 h-3" />
        Zostało {daysRemaining} dni
      </Badge>
    );
  };

  const expiredCount = trustedDevices?.filter(d => getDaysRemaining(d.created_at) <= 0).length || 0;

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
              Gdy usuniesz urządzenie z listy zaufanych, przy następnym logowaniu z tego urządzenia 
              otrzymasz kod weryfikacyjny na email.
            </AlertDescription>
          </Alert>

          <Alert>
            <Clock className="w-4 h-4" />
            <AlertDescription>
              Zaufane urządzenia wygasają automatycznie po <strong>{TRUST_PERIOD_DAYS} dniach</strong>. 
              Po wygaśnięciu usuń urządzenie z listy, aby przy następnym logowaniu zweryfikować je ponownie kodem.
            </AlertDescription>
          </Alert>

          {trustedDevices && trustedDevices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {expiredCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveExpired}
                  disabled={isCleaningExpired}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isCleaningExpired ? 'Usuwanie...' : `Usuń wygasłe (${expiredCount})`}
                </Button>
              )}
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
                Zaznacz "Dodaj do zaufanych" podczas logowania, aby nie otrzymywać kodów weryfikacyjnych
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {device.device_name || 'Nieznane urządzenie'}
                      </p>
                      {getExpiryBadge(device.created_at)}
                    </div>
                    
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
