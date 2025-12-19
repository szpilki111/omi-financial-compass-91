import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';

const SecuritySettingsManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch 2FA setting
  const { data: twoFactorEnabled, isLoading } = useQuery({
    queryKey: ['app-settings', 'two_factor_auth_enabled'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'two_factor_auth_enabled')
        .maybeSingle();

      if (error) throw error;
      return data?.value === true || data?.value === 'true';
    },
  });

  // Update 2FA setting mutation
  const updateTwoFactorMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: enabled,
          updated_at: new Date().toISOString(),
          updated_by: user?.id 
        })
        .eq('key', 'two_factor_auth_enabled');

      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast({
        title: enabled ? 'Weryfikacja dwuetapowa włączona' : 'Weryfikacja dwuetapowa wyłączona',
        description: enabled 
          ? 'Użytkownicy będą musieli potwierdzić logowanie kodem z emaila.'
          : 'Użytkownicy będą mogli logować się bez dodatkowej weryfikacji.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    updateTwoFactorMutation.mutate(checked);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Ustawienia bezpieczeństwa
        </CardTitle>
        <CardDescription>
          Zarządzaj globalnym ustawieniem bezpieczeństwa aplikacji
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            {twoFactorEnabled ? (
              <ShieldCheck className="h-8 w-8 text-green-600" />
            ) : (
              <ShieldOff className="h-8 w-8 text-destructive" />
            )}
            <div>
              <Label htmlFor="two-factor-toggle" className="text-base font-medium">
                Weryfikacja dwuetapowa (2FA)
              </Label>
              <p className="text-sm text-muted-foreground">
                {twoFactorEnabled 
                  ? 'Włączona - użytkownicy muszą potwierdzić logowanie kodem z emaila'
                  : 'Wyłączona - użytkownicy logują się tylko hasłem'}
              </p>
            </div>
          </div>
          <Switch
            id="two-factor-toggle"
            checked={twoFactorEnabled ?? true}
            onCheckedChange={handleToggle}
            disabled={updateTwoFactorMutation.isPending}
          />
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Jak działa weryfikacja dwuetapowa?</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Przy logowaniu z nowego urządzenia, użytkownik otrzyma kod na email</li>
            <li>Po poprawnym wprowadzeniu kodu, urządzenie może być zapamiętane na 30 dni</li>
            <li>Zapamiętane urządzenia nie wymagają ponownej weryfikacji</li>
            <li>Wyłączenie 2FA zmniejsza bezpieczeństwo, ale upraszcza logowanie</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecuritySettingsManagement;
