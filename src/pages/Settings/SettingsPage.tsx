
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountsSettingsTab } from './AccountsSettingsTab';

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user settings directly from the table
  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('windows98_style')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        return { windows98_style: false };
      }

      return data || { windows98_style: false };
    },
    enabled: !!user?.id
  });

  // Mutation to save settings using upsert with better error handling
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: { windows98_style: boolean }) => {
      if (!user?.id) throw new Error('Brak użytkownika');

      console.log('Saving settings:', newSettings, 'for user:', user.id);

      // First, try to get existing settings
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        // Update existing record
        const { error } = await supabase
          .from('user_settings')
          .update({
            windows98_style: newSettings.windows98_style,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            windows98_style: newSettings.windows98_style,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }
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
        description: "Nie udało się zapisać ustawień. Spróbuj ponownie.",
        variant: "destructive"
      });
    }
  });

  const handleStyleToggle = (checked: boolean) => {
    console.log('Style toggle changed to:', checked);
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

        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList>
            <TabsTrigger value="appearance">Wygląd</TabsTrigger>
            <TabsTrigger value="accounts">Konta</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance">
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
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;
