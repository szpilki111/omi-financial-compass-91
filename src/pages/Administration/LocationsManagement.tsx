
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LocationDialog from './LocationDialog';
import LocationSettingsDialog from './LocationSettingsDialog';

interface Location {
  id: string;
  name: string;
  address: string | null;
  location_identifier: string | null;
  nip: string | null;
  regon: string | null;
  created_at: string;
}

interface LocationWithSettings extends Location {
  house_abbreviation?: string;
  allow_foreign_currencies?: boolean;
}

const LocationsManagement = () => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedLocationForSettings, setSelectedLocationForSettings] = useState<Location | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pobierz listę placówek z ustawieniami
  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (locationsError) throw locationsError;

      // Pobierz ustawienia dla wszystkich lokalizacji
      const { data: settingsData, error: settingsError } = await supabase
        .from('location_settings')
        .select('location_id, house_abbreviation, allow_foreign_currencies');

      if (settingsError) throw settingsError;

      // Połącz dane
      const locationsWithSettings: LocationWithSettings[] = locationsData.map(location => {
        const settings = settingsData?.find(s => s.location_id === location.id);
        return {
          ...location,
          house_abbreviation: settings?.house_abbreviation,
          allow_foreign_currencies: settings?.allow_foreign_currencies
        };
      });

      return locationsWithSettings;
    }
  });

  // Mutacja do usuwania placówki
  const deleteMutation = useMutation({
    mutationFn: async (locationId: string) => {
      // Sprawdź czy istnieją powiązane transakcje
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('id')
        .eq('location_id', locationId)
        .limit(1);

      if (transactionsError) throw transactionsError;

      if (transactions && transactions.length > 0) {
        throw new Error('Nie można usunąć placówki - istnieją powiązane operacje');
      }

      // Sprawdź czy istnieją powiązane raporty
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id')
        .eq('location_id', locationId)
        .limit(1);

      if (reportsError) throw reportsError;

      if (reports && reports.length > 0) {
        throw new Error('Nie można usunąć placówki - istnieją powiązane raporty');
      }

      // Usuń najpierw ustawienia lokalizacji (jeśli istnieją)
      await supabase
        .from('location_settings')
        .delete()
        .eq('location_id', locationId);

      // Usuwanie placówki
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

  const handleEdit = (location: Location) => {
    setSelectedLocation(location);
    setIsDialogOpen(true);
  };

  const handleSettings = (location: Location) => {
    setSelectedLocationForSettings(location);
    setIsSettingsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedLocation(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (location: Location) => {
    if (confirm(`Czy na pewno chcesz usunąć placówkę "${location.name}"?`)) {
      deleteMutation.mutate(location.id);
    }
  };

  const handleDialogClose = (saved: boolean) => {
    setIsDialogOpen(false);
    setSelectedLocation(null);
    if (saved) {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    }
  };

  const handleSettingsDialogClose = (saved: boolean) => {
    setIsSettingsDialogOpen(false);
    setSelectedLocationForSettings(null);
    if (saved) {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie placówek...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Zarządzanie placówkami</CardTitle>
            <Button onClick={handleAdd} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Dodaj placówkę
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!locations?.length ? (
            <p className="text-center text-omi-gray-500">Brak placówek w systemie.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Identyfikator</TableHead>
                  <TableHead>NIP</TableHead>
                  <TableHead>REGON</TableHead>
                  <TableHead>Skrót</TableHead>
                  <TableHead>Waluty zagraniczne</TableHead>
                  <TableHead>Adres</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>
                      {location.location_identifier ? (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-mono">
                          {location.location_identifier}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{location.nip || '-'}</TableCell>
                    <TableCell>{location.regon || '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        location.house_abbreviation 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {location.house_abbreviation || 'Brak'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        location.allow_foreign_currencies 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {location.allow_foreign_currencies ? 'Dozwolone' : 'Tylko PLN'}
                      </span>
                    </TableCell>
                    <TableCell>{location.address || '-'}</TableCell>
                    <TableCell>
                      {new Date(location.created_at).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSettings(location)}
                          title="Ustawienia placówki"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(location)}
                          title="Edytuj placówkę"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(location)}
                          disabled={deleteMutation.isPending}
                          title="Usuń placówkę"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LocationDialog
        location={selectedLocation}
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
      />

      <LocationSettingsDialog
        location={selectedLocationForSettings}
        isOpen={isSettingsDialogOpen}
        onClose={handleSettingsDialogClose}
      />
    </div>
  );
};

export default LocationsManagement;
