import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountsSettingsTab } from './AccountsSettingsTab';
import TrustedDevicesTab from './TrustedDevicesTab';
import { MapPin, Building2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserLocation {
  id: string;
  name: string;
  location_identifier: string | null;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's assigned locations
  const { data: userLocations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ['user-locations', user?.id],
    queryFn: async (): Promise<UserLocation[]> => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_locations')
        .select('location_id, locations!inner(id, name, location_identifier)')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user locations:', error);
        return [];
      }

      return (data || []).map((ul: any) => ul.locations as UserLocation);
    },
    enabled: !!user?.id
  });

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

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="appearance">Wygląd</TabsTrigger>
            <TabsTrigger value="security">Bezpieczeństwo</TabsTrigger>
            <TabsTrigger value="accounts">Konta</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="space-y-6">
              {/* User info card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informacje o użytkowniku
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Imię i nazwisko</Label>
                      <p className="font-medium">{user?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <p className="font-medium">{user?.email || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Rola</Label>
                      <Badge variant="secondary" className="mt-1">
                        {user?.role === 'admin' ? 'Administrator' : 
                         user?.role === 'prowincjal' ? 'Prowincjał' : 
                         user?.role === 'ekonom' ? 'Ekonom' : 
                         user?.role === 'proboszcz' ? 'Proboszcz' : 
                         user?.role || '-'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assigned locations card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Przypisane placówki
                  </CardTitle>
                  <CardDescription>
                    Lista lokalizacji, do których masz dostęp w systemie
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingLocations ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : userLocations && userLocations.length > 0 ? (
                    <div className="space-y-2">
                      {userLocations.map((location) => (
                        <div 
                          key={location.id} 
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                        >
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{location.name}</p>
                          </div>
                          {location.location_identifier && (
                            <Badge variant="outline" className="flex-shrink-0">
                              {location.location_identifier}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Brak przypisanych placówek</p>
                      <p className="text-sm">Skontaktuj się z administratorem, aby uzyskać dostęp.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

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

          <TabsContent value="security">
            <TrustedDevicesTab />
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
