
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const userSchema = z.object({
  name: z.string().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki'),
  email: z.string().email('Nieprawidłowy adres email'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
  role: z.enum(['ekonom', 'prowincjal', 'admin'], {
    required_error: 'Wybierz rolę użytkownika',
  }),
  location_id: z.string().optional(),
  new_location_name: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Location {
  id: string;
  name: string;
}

const UserDialog = ({ open, onOpenChange }: UserDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingNewLocation, setIsCreatingNewLocation] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ekonom',
      location_id: 'no-location',
      new_location_name: '',
    },
  });

  // Pobierz listę placówek
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Location[];
    }
  });

  // Mutacja do tworzenia użytkownika używając logiki z Login
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      console.log("Rozpoczynanie procesu tworzenia użytkownika przez administratora...");
      
      // Sprawdź czy administrator jest zalogowany
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error('Brak sesji administratora');
      }

      // Zapisz aktualną sesję
      const adminSession = currentSession;
      console.log("Sesja administratora zapisana:", adminSession.user.email);

      // Wyloguj administratora tymczasowo, żeby móc utworzyć nowego użytkownika
      await supabase.auth.signOut();
      console.log("Administrator tymczasowo wylogowany");

      try {
        // Utwórz nowego użytkownika
        const { data: newUserData, error: signUpError } = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              full_name: userData.name,
              role: userData.role
            }
          }
        });

        if (signUpError) {
          console.error("Signup error:", signUpError);
          throw new Error(signUpError.message);
        }

        if (!newUserData.user) {
          throw new Error("Nie udało się utworzyć użytkownika");
        }

        console.log("Nowy użytkownik utworzony:", newUserData.user.id);

        // Utwórz nową lokalizację jeśli wybrano taką opcję
        let selectedLocationId = userData.location_id === 'no-location' ? null : userData.location_id;
        
        if (isCreatingNewLocation && userData.new_location_name?.trim()) {
          console.log("Tworzenie nowej lokalizacji:", userData.new_location_name);
          
          // Przywróć sesję administratora żeby móc utworzyć lokalizację
          await supabase.auth.setSession(adminSession);
          
          const { data: locationData, error: locationError } = await supabase
            .from('locations')
            .insert({
              name: userData.new_location_name.trim(),
            })
            .select('id')
            .single();

          if (locationError) {
            console.error("Error creating location:", locationError);
            throw new Error("Nie udało się utworzyć lokalizacji: " + locationError.message);
          }
          
          if (locationData) {
            selectedLocationId = locationData.id;
            console.log("Lokalizacja utworzona:", selectedLocationId);
          }
          
          // Wyloguj administratora ponownie
          await supabase.auth.signOut();
        }

        // Utwórz profil użytkownika
        try {
          console.log("Tworzenie profilu użytkownika...");
          const { error: directProfileError } = await supabase
            .from('profiles')
            .insert({
              id: newUserData.user.id,
              name: userData.name,
              role: userData.role,
              email: userData.email,
              location_id: selectedLocationId
            });

          if (directProfileError) {
            console.error("Error creating profile directly:", directProfileError);
            throw new Error("Nie udało się utworzyć profilu użytkownika");
          }

          console.log("Profil użytkownika utworzony pomyślnie");
        } catch (profileErr) {
          console.error("Profile creation error:", profileErr);
          throw new Error("Nie udało się utworzyć profilu użytkownika");
        }

        // Przywróć sesję administratora
        await supabase.auth.setSession(adminSession);
        console.log("Sesja administratora przywrócona");

        return newUserData;
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
        description: 'Użytkownik został utworzony pomyślnie',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      setIsCreatingNewLocation(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error creating user:', error);
      let errorMessage = 'Nie udało się utworzyć użytkownika';
      
      if (error.message?.includes('User already registered')) {
        errorMessage = 'Użytkownik z tym adresem email już istnieje';
      } else if (error.message?.includes('invalid email')) {
        errorMessage = 'Nieprawidłowy adres email';
      } else if (error.message?.includes('weak password')) {
        errorMessage = 'Hasło jest zbyt słabe';
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

  const onSubmit = (data: UserFormData) => {
    console.log("Dane formularza:", data);
    createUserMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setIsCreatingNewLocation(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dodaj nowego użytkownika</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imię i nazwisko</FormLabel>
                  <FormControl>
                    <Input placeholder="Jan Kowalski" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="jan.kowalski@example.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hasło</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Wprowadź hasło (min. 6 znaków)" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rola</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz rolę" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ekonom">Ekonom</SelectItem>
                      <SelectItem value="prowincjal">Prowincjał</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <FormLabel>Placówka (opcjonalnie)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-blue-600 h-6 px-2"
                  onClick={() => setIsCreatingNewLocation(!isCreatingNewLocation)}
                >
                  {isCreatingNewLocation ? "Wybierz istniejącą" : "Utwórz nową"}
                </Button>
              </div>
              
              {isCreatingNewLocation ? (
                <FormField
                  control={form.control}
                  name="new_location_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Nazwa nowej placówki" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="location_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz placówkę" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no-location">Brak przypisania</SelectItem>
                          {locations?.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createUserMutation.isPending}
              >
                Anuluj
              </Button>
              <Button 
                type="submit" 
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? 'Tworzenie...' : 'Utwórz użytkownika'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UserDialog;
