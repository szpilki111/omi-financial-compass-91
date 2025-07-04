
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import LocationDialog from './LocationDialog';
import LocationSettingsDialog from './LocationSettingsDialog';
import { Switch } from '@/components/ui/switch';

interface Location {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  location_settings?: {
    house_abbreviation: string;
    allow_foreign_currencies: boolean;
  } | null;
}

const LocationsManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  // Pobierz lokalizacje z ustawieniami
  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          location_settings (
            house_abbreviation,
            allow_foreign_currencies
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Location[];
    },
  });

  // Mutacja do aktualizacji uprawnień walutowych
  const updateCurrencyPermissionMutation = useMutation({
    mutationFn: async ({ locationId, allowForeignCurrencies }: { locationId: string; allowForeignCurrencies: boolean }) => {
      // Sprawdź czy istnieją ustawienia dla tej lokalizacji
      const { data: existingSettings } = await supabase
        .from('location_settings')
        .select('id')
        .eq('location_id', locationId)
        .maybeSingle();

      if (existingSettings) {
        // Aktualizuj istniejące ustawienia
        const { error } = await supabase
          .from('location_settings')
          .update({ allow_foreign_currencies: allowForeignCurrencies })
          .eq('location_id', locationId);

        if (error) throw error;
      } else {
        // Utwórz nowe ustawienia z domyślnym skrótem
        const { error } = await supabase
          .from('location_settings')
          .insert({
            location_id: locationId,
            house_abbreviation: 'DOM',
            allow_foreign_currencies: allowForeignCurrencies,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({
        title: "Sukces",
        description: "Ustawienia walutowe zostały zaktualizowane.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutacja do usuwania lokalizacji
  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      // Najpierw usuń ustawienia lokalizacji
      await supabase
        .from('location_settings')
        .delete()
        .eq('location_id', locationId);
      
      // Następnie usuń lokalizację
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({
        title: "Sukces",
        description: "Placówka została usunięta.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAddLocation = () => {
    setSelectedLocation(null);
    setIsLocationDialogOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location);
    setIsLocationDialogOpen(true);
  };

  const handleEditSettings = (location: Location) => {
    setSelectedLocation(location);
    setIsSettingsDialogOpen(true);
  };

  const handleDeleteLocation = (locationId: string) => {
    if (confirm('Czy na pewno chcesz usunąć tę placówkę?')) {
      deleteLocationMutation.mutate(locationId);
    }
  };

  const handleCurrencyPermissionChange = (locationId: string, allowed: boolean) => {
    updateCurrencyPermissionMutation.mutate({
      locationId,
      allowForeignCurrencies: allowed,
    });
  };

  const handleLocationDialogClose = (saved: boolean) => {
    setIsLocationDialogOpen(false);
    if (saved) {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    }
  };

  const handleSettingsDialogClose = (saved: boolean) => {
    setIsSettingsDialogOpen(false);
    if (saved) {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Zarządzanie placówkami</CardTitle>
          <Button onClick={handleAddLocation}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj placówkę
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Nazwa</th>
                  <th className="text-left p-3 font-medium">Skrót</th>
                  <th className="text-left p-3 font-medium">Adres</th>
                  <th className="text-left p-3 font-medium">Data utworzenia</th>
                  <th className="text-left p-3 font-medium">Waluty obce</th>
                  <th className="text-left p-3 font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {locations?.map((location) => (
                  <tr key={location.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{location.name}</td>
                    <td className="p-3">
                      <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                        {location.location_settings?.house_abbreviation || 'DOM'}
                      </span>
                    </td>
                    <td className="p-3">{location.address || '-'}</td>
                    <td className="p-3">
                      {new Date(location.created_at).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={location.location_settings?.allow_foreign_currencies || false}
                          onCheckedChange={(checked) => handleCurrencyPermissionChange(location.id, checked)}
                          disabled={updateCurrencyPermissionMutation.isPending}
                        />
                        <span className="text-sm text-gray-600">
                          {location.location_settings?.allow_foreign_currencies ? 'Dozwolone' : 'Zablokowane'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSettings(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLocation(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLocation(location.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <LocationDialog
        location={selectedLocation}
        isOpen={isLocationDialogOpen}
        onClose={handleLocationDialogClose}
      />

      <LocationSettingsDialog
        location={selectedLocation}
        isOpen={isSettingsDialogOpen}
        onClose={handleSettingsDialogClose}
      />
    </div>
  );
};

export default LocationsManagement;
