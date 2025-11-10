import React, { useState, useEffect } from 'react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import { cn } from '@/lib/utils';

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
  isAutoAssigned?: boolean;
}

const LocationAccountsManagement = () => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [accountSelectOpen, setAccountSelectOpen] = useState(false);
  const [locationSelectOpen, setLocationSelectOpen] = useState(false);
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

  // Function to search accounts based on query
  const searchAccounts = async (query: string) => {
    if (!query || query.length < 2) {
      setAccounts([]);
      return;
    }

    try {
      setIsSearching(true);
      console.log('Wyszukiwanie kont dla zapytania:', query);
      
      const { data, error } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .or(`number.ilike.%${query}%,name.ilike.%${query}%`)
        .order('number', { ascending: true })
        .limit(50);
        
      if (error) {
        console.error('Błąd podczas wyszukiwania kont:', error);
        throw error;
      }
      
      console.log('Znalezione konta:', data);
      console.log('Liczba znalezionych kont:', data?.length || 0);
      
      setAccounts(data || []);
    } catch (error) {
      console.error('Błąd podczas wyszukiwania kont:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się wyszukać kont",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Effect to handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAccounts(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset search when component unmounts or clears
  useEffect(() => {
    return () => {
      setSearchQuery('');
      setAccounts([]);
    };
  }, []);

  // Fetch location-account assignments with proper joins
  const { data: locationAccounts, isLoading } = useQuery({
    queryKey: ['location-accounts'],
    queryFn: async () => {
      console.log('Pobieranie przypisań kont do placówek...');
      
      const { data: assignments, error } = await supabase
        .from('location_accounts')
        .select(`
          id,
          location_id,
          account_id,
          created_at,
          locations!location_accounts_location_id_fkey (
            id,
            name
          ),
          accounts!location_accounts_account_id_fkey (
            id,
            number,
            name,
            type
          )
        `)
        .order('created_at');
      
      if (error) {
        console.error('Błąd podczas pobierania przypisań:', error);
        throw error;
      }

      console.log('Pobrane przypisania:', assignments);

      if (!assignments) return [];

      // Przekształć dane na oczekiwany format
      const result: LocationAccount[] = assignments.map(assignment => {
        console.log('Przetwarzanie przypisania:', assignment);
        
        return {
          id: assignment.id,
          location_id: assignment.location_id,
          account_id: assignment.account_id,
          locations: assignment.locations || { id: assignment.location_id, name: 'Unknown Location' },
          accounts: assignment.accounts || { id: assignment.account_id, number: 'Unknown', name: 'Unknown Account', type: 'Unknown' }
        };
      });

      console.log('Przetworzone przypisania:', result);

      // Sort by location name, then account number
      return result.sort((a, b) => {
        const locationCompare = a.locations.name.localeCompare(b.locations.name);
        if (locationCompare !== 0) return locationCompare;
        return a.accounts.number.localeCompare(b.accounts.number);
      });
    }
  });

  // Fetch accounts automatically assigned by location identifier
  const { data: autoAssignedAccounts } = useQuery({
    queryKey: ['auto-assigned-accounts', selectedLocationId],
    queryFn: async () => {
      if (!selectedLocationId) return [];

      // Get the selected location's identifier
      const selectedLocation = locations?.find(loc => loc.id === selectedLocationId);
      if (!selectedLocation?.location_identifier) return [];

      console.log('Pobieranie kont dla identyfikatora:', selectedLocation.location_identifier);

      // Fetch all accounts that end with the location identifier
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, number, name, type')
        .like('number', `%-${selectedLocation.location_identifier}`)
        .order('number');

      if (error) {
        console.error('Błąd podczas pobierania kont dla identyfikatora:', error);
        throw error;
      }

      console.log('Znalezione konta dla identyfikatora:', accounts);

      return accounts?.map(account => ({
        id: `auto-${account.id}`, // Prefix to distinguish from manual assignments
        location_id: selectedLocationId,
        account_id: account.id,
        locations: selectedLocation,
        accounts: account,
        isAutoAssigned: true
      })) || [];
    },
    enabled: !!selectedLocationId && !!locations
  });

  // Add location-account assignment
  const addMutation = useMutation({
    mutationFn: async ({ locationId, accountId }: { locationId: string; accountId: string }) => {
      console.log('Dodawanie przypisania:', { locationId, accountId });
      
      // Sprawdź czy przypisanie już istnieje
      const { data: existing, error: checkError } = await supabase
        .from('location_accounts')
        .select('id')
        .eq('location_id', locationId)
        .eq('account_id', accountId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        throw new Error('To konto jest już przypisane do tej placówki');
      }

      const { error } = await supabase
        .from('location_accounts')
        .insert({
          location_id: locationId,
          account_id: accountId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-accounts'] });
      // Keep selectedLocationId unchanged, only clear account-related fields
      setSelectedAccountId('');
      setSearchQuery('');
      setAccounts([]);
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
        .from('location_accounts')
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

  const handleAccountChange = (accountId: string) => {
    const selectedAccount = accounts.find(acc => acc.id === accountId);
    
    setSelectedAccountId(accountId);
    
    // Set search query to show selected account
    if (selectedAccount) {
      setSearchQuery(`${selectedAccount.number} - ${selectedAccount.name}`);
    }
    
    setAccountSelectOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Clear selected account if user changes search text
    if (selectedAccountId) {
      const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
      if (selectedAccount && value !== `${selectedAccount.number} - ${selectedAccount.name}`) {
        setSelectedAccountId('');
      }
    }
  };

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

  // Filter assignments to show only those for the selected location
  const filteredAssignments = locationAccounts?.filter(assignment => 
    !selectedLocationId || assignment.location_id === selectedLocationId
  ) || [];

  // Combine manual assignments with auto-assigned accounts
  const allAssignments = [
    ...filteredAssignments,
    ...(autoAssignedAccounts || [])
  ];

  // Group all assignments by location
  const groupedAssignments = allAssignments.reduce((acc, assignment) => {
    const locationName = assignment.locations.name;
    if (!acc[locationName]) {
      acc[locationName] = [];
    }
    acc[locationName].push(assignment);
    return acc;
  }, {} as Record<string, LocationAccount[]>);

  const selectedAccount = accounts.find(account => account.id === selectedAccountId);
  const selectedLocation = locations?.find(location => location.id === selectedLocationId);

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
              <Popover open={locationSelectOpen} onOpenChange={setLocationSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={locationSelectOpen}
                    className="w-full justify-between"
                  >
                    {selectedLocation ? selectedLocation.name : "Wybierz placówkę..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-white border shadow-lg z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput placeholder="Wpisz nazwę placówki..." />
                    <CommandList className="max-h-60 overflow-y-auto">
                      <CommandEmpty>Nie znaleziono placówki.</CommandEmpty>
                      <CommandGroup>
                        {locations?.map((location) => (
                          <CommandItem
                            key={location.id}
                            value={location.name}
                            onSelect={() => {
                              setSelectedLocationId(location.id);
                              setLocationSelectOpen(false);
                            }}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLocation?.id === location.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {location.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">
                Konto 
                {searchQuery.length >= 2 && (
                  <span className="text-gray-500">
                    ({isSearching ? 'Wyszukiwanie...' : `${accounts.length} znalezionych kont`})
                  </span>
                )}
              </label>
              <Popover open={accountSelectOpen} onOpenChange={setAccountSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountSelectOpen}
                    className="w-full justify-between"
                  >
                    {selectedAccount ? 
                      `${selectedAccount.number} - ${selectedAccount.name}` : 
                      searchQuery || "Wybierz konto..."
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-white border shadow-lg z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput 
                      placeholder="Wpisz numer lub nazwę konta..."
                      value={searchQuery}
                      onValueChange={handleSearchChange}
                    />
                    <CommandList className="max-h-60 overflow-y-auto">
                      {searchQuery.length < 2 ? (
                        <div className="py-6 text-center text-sm text-gray-500">
                          Wpisz co najmniej 2 znaki, aby wyszukać konta...
                        </div>
                      ) : isSearching ? (
                        <div className="py-6 text-center text-sm text-gray-500">
                          Wyszukiwanie...
                        </div>
                      ) : accounts.length === 0 ? (
                        <CommandEmpty>Nie znaleziono konta.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {accounts.map((account) => (
                            <CommandItem
                              key={account.id}
                              value={`${account.number} ${account.name}`}
                              onSelect={() => handleAccountChange(account.id)}
                              className="cursor-pointer hover:bg-gray-100"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {account.number} - {account.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

          {!selectedLocationId ? (
            <p className="text-center text-gray-500">Wybierz placówkę, aby zobaczyć przypisane konta.</p>
          ) : Object.keys(groupedAssignments).length === 0 ? (
            <p className="text-center text-gray-500">Brak przypisanych kont do wybranej placówki.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAssignments).map(([locationName, assignments]) => (
                <div key={locationName}>
                  <h3 className="text-lg font-medium mb-3">{locationName}</h3>
                  <ScrollableTable>
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
                            {assignment.isAutoAssigned && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                Auto
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{assignment.accounts.name}</TableCell>
                          <TableCell>{assignment.accounts.type}</TableCell>
                          <TableCell className="text-right">
                            {!assignment.isAutoAssigned && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(assignment.id)}
                                disabled={deleteMutation.isPending}
                                title="Usuń przypisanie"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {assignment.isAutoAssigned && (
                              <span className="text-xs text-gray-500">
                                Przypisane automatycznie
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </ScrollableTable>
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
