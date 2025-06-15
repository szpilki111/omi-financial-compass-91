
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user settings using RPC function
  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .rpc('get_user_setting', { p_user_id: user.id })
        .single();

      if (error) {
        // If no settings exist yet, return default
        return { windows98_style: false };
      }

      return data || { windows98_style: false };
    },
    enabled: !!user?.id
  });

  // Mutation to save settings using RPC function
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: { windows98_style: boolean }) => {
      if (!user?.id) throw new Error('Brak użytkownika');

      const { data, error } = await supabase
        .rpc('upsert_user_setting', {
          p_user_id: user.id,
          p_windows98_style: newSettings.windows98_style
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({
        title: "Sukces",
        description: "Ustawienia zostały zapisane",
      });
      // Reload page to apply new style
      window.location.reload();
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać ustawień",
        variant: "destructive"
      });
    }
  });

  const handleStyleToggle = (checked: boolean) => {
    updateSettingsMutation.mutate({ windows98_style: checked });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ustawienia</h1>
          <p className="text-gray-600">Personalizuj wygląd i zachowanie aplikacji</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Wygląd aplikacji</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="windows98-style" className="text-base">
                  Styl Windows 98
                </Label>
                <div className="text-sm text-gray-500">
                  Zmień wygląd aplikacji na styl retro Windows 98
                </div>
              </div>
              <Switch
                id="windows98-style"
                checked={settings?.windows98_style || false}
                onCheckedChange={handleStyleToggle}
                disabled={updateSettingsMutation.isPending}
              />
            </div>
            
            <Separator />
            
            <div className="text-sm text-gray-500">
              <p>
                Styl Windows 98 zmieni kolory i wygląd interfejsu na bardziej retro.
                Zmiana zostanie zastosowana po odświeżeniu strony.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;
