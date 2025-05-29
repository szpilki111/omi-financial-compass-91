
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
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LocationDialog from './LocationDialog';

interface Location {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

const LocationsManagement = () => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pobierz listę placówek
  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Location[];
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
                  <TableHead>Adres</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>{location.address || '-'}</TableCell>
                    <TableCell>
                      {new Date(location.created_at).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(location)}
                          disabled={deleteMutation.isPending}
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
    </div>
  );
};

export default LocationsManagement;
