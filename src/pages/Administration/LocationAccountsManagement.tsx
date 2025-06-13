
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Location {
  id: string;
  name: string;
}

interface Account {
  id: string;
  number: string;
  name: string;
  type: string;
}

interface LocationAccount {
  id: string;
  location_id: string;
  account_id: string;
  locations: Location;
  accounts: Account;
}

const LocationAccountsManagement = () => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('number');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch location-account assignments
  const { data: locationAccounts, isLoading } = useQuery({
    queryKey: ['location-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('location_accounts' as any)
        .select(`
          *,
          locations (id, name),
          accounts (id, number, name, type)
        `)
        .order('locations.name, accounts.number');
      
      if (error) throw error;
      return data as LocationAccount[];
    }
  });

  // Add location-account assignment
  const addMutation = useMutation({
    mutationFn: async ({ locationId, accountId }: { locationId: string; accountId: string }) => {
      const { error } = await supabase
        .from('location_accounts' as any)
        .insert({
          location_id: locationId,
          account_id: accountId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-accounts'] });
      setSelectedLocationId('');
      setSelectedAccountId('');
      toast({
        title: "Sukces",
        description: "Przypisanie konta do placówki zostało dodane.",
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

  // Remove location-account assignment
  const deleteMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('location_accounts' as any)
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-accounts'] });
      toast({
        title: "Sukces",
        description: "Przypisanie konta zostało usunięte.",
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

  const handleAdd = () => {
    if (!selectedLocationId || !selectedAccountId) {
      toast({
        title: "Błąd",
        description: "Wybierz placówkę i konto.",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate({
      locationId: selectedLocationId,
      accountId: selectedAccountId,
    });
  };

  const handleDelete = (assignmentId: string) => {
    if (confirm('Czy na pewno chcesz usunąć to przypisanie?')) {
      deleteMutation.mutate(assignmentId);
    }
  };

  // Group assignments by location
  const groupedAssignments = locationAccounts?.reduce((acc, assignment) => {
    const locationName = assignment.locations.name;
    if (!acc[locationName]) {
      acc[locationName] = [];
    }
    acc[locationName].push(assignment);
    return acc;
  }, {} as Record<string, LocationAccount[]>) || {};

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie przypisań kont...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Przypisywanie kont do placówek</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end mb-6">
            <div className="flex-1">
              <label className="text-sm font-medium">Placówka</label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz placówkę" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Konto</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz konto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.number} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAdd} 
              disabled={addMutation.isPending}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>

          {Object.keys(groupedAssignments).length === 0 ? (
            <p className="text-center text-gray-500">Brak przypisań kont do placówek.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAssignments).map(([locationName, assignments]) => (
                <div key={locationName}>
                  <h3 className="text-lg font-medium mb-3">{locationName}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numer konta</TableHead>
                        <TableHead>Nazwa konta</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead className="text-right">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {assignment.accounts.number}
                          </TableCell>
                          <TableCell>{assignment.accounts.name}</TableCell>
                          <TableCell>{assignment.accounts.type}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(assignment.id)}
                              disabled={deleteMutation.isPending}
                              title="Usuń przypisanie"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationAccountsManagement;
