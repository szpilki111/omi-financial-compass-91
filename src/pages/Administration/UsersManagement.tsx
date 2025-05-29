
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import UserDialog from './UserDialog';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  location_id: string | null;
  created_at: string;
  location?: {
    name: string;
  };
}

const getRoleBadgeProps = (role: string) => {
  switch (role) {
    case 'admin':
      return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200' };
    case 'prowincjal':
      return { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'ekonom':
      return { variant: 'outline' as const, className: 'bg-green-100 text-green-800 border-green-200' };
    default:
      return { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Administrator';
    case 'prowincjal': return 'Prowincjał';
    case 'ekonom': return 'Ekonom';
    default: return role;
  }
};

const UsersManagement = () => {
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          location:locations(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserProfile[];
    }
  });

// Mutacja do usuwania użytkownika używając logiki z Login
const deleteUserMutation = useMutation({
  mutationFn: async (userId: string) => {
    console.log("Rozpoczynanie procesu usuwania użytkownika przez administratora...");

    // Sprawdź, czy administrator jest zalogowany
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      throw new Error('Brak sesji administratora');
    }

    // Zapisz aktualną sesję
    const adminSession = currentSession;
    console.log("Sesja administratora zapisana:", adminSession.user.email);

    try {
      // Najpierw usuń profil użytkownika
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileDeleteError) {
        console.error("Error deleting profile:", profileDeleteError);
        throw new Error("Nie udało się usunąć profilu użytkownika");
      }

      console.log("Profil użytkownika usunięty pomyślnie");

      // Następnie usuń użytkownika z Supabase Auth
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        console.error("Error deleting user from Auth:", authDeleteError);
        throw new Error("Nie udało się usunąć użytkownika z systemu autoryzacji");
      }

      console.log("Użytkownik usunięty pomyślnie");
    } catch (error) {
      // W przypadku błędu, zawsze przywróć sesję administratora
      try {
        await supabase.auth.setSession(adminSession);
        console.log("Sesja administratora przywrócona po błędzie");
      } catch (restoreError) {
        console.error("Nie udało się przywrócić sesji administratora:", restoreError);
      }
      throw error;
    }
  },
  onSuccess: () => {
    toast({
      title: 'Sukces',
      description: 'Użytkownik został usunięty pomyślnie',
    });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
  onError: (error: any) => {
    console.error('Error deleting user:', error);
    let errorMessage = 'Nie udało się usunąć użytkownika';

    if (error.message?.includes('User not found')) {
      errorMessage = 'Użytkownik nie został znaleziony';
    } else if (error.message) {
      errorMessage = error.message;
    }

    toast({
      title: 'Błąd',
      description: errorMessage,
      variant: 'destructive',
    });
  },
});

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie użytkowników...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Zarządzanie użytkownikami</CardTitle>
          <Button onClick={() => setIsUserDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj użytkownika
          </Button>
        </CardHeader>
        <CardContent>
          {!users?.length ? (
            <p className="text-center text-omi-gray-500">Brak użytkowników w systemie.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię i nazwisko</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead>Placówka</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge {...getRoleBadgeProps(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.location?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Usuń użytkownika</AlertDialogTitle>
                            <AlertDialogDescription>
                              Czy na pewno chcesz usunąć użytkownika <strong>{user.name}</strong>? 
                              Ta operacja jest nieodwracalna i usunie wszystkie dane związane z tym użytkownikiem.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Usuń użytkownika
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserDialog 
        open={isUserDialogOpen} 
        onOpenChange={setIsUserDialogOpen} 
      />
    </>
  );
};

export default UsersManagement;
