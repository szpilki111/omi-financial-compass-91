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
  login: z.string().min(3, 'Login musi mieć co najmniej 3 znaki')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Login może zawierać tylko litery, cyfry, myślniki i podkreślenia'),
  first_name: z.string().min(2, 'Imię musi mieć co najmniej 2 znaki'),
  last_name: z.string().min(2, 'Nazwisko musi mieć co najmniej 2 znaki'),
  position: z.string().min(2, 'Stanowisko musi mieć co najmniej 2 znaki'),
  email: z.string().email('Nieprawidłowy adres email'),
  phone: z.string().optional(),
  password: z.string().optional().or(z.literal('')),
  role: z.enum(['ekonom', 'prowincjal', 'admin', 'proboszcz', 'asystent', 'asystent_ekonoma_prowincjalnego', 'ekonom_prowincjalny'], {
    required_error: 'Wybierz rolę użytkownika',
  }),
  location_id: z.string().optional(),
  new_location_name: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser?: {
    id: string;
    login: string;
    first_name: string;
    last_name: string;
    position: string;
    email: string;
    phone: string | null;
    role: string;
    location_id: string | null;
  } | null;
}

interface Location {
  id: string;
  name: string;
}

const UserDialog = ({ open, onOpenChange, editingUser }: UserDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingNewLocation, setIsCreatingNewLocation] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      login: editingUser?.login || '',
      first_name: editingUser?.first_name || '',
      last_name: editingUser?.last_name || '',
      position: editingUser?.position || '',
      email: editingUser?.email || '',
      phone: editingUser?.phone || '',
      password: '',
      role: (editingUser?.role as any) || 'ekonom',
      location_id: editingUser?.location_id || 'no-location',
      new_location_name: '',
    },
  });

  // Reset form when editingUser changes
  React.useEffect(() => {
    if (editingUser) {
      form.reset({
        login: editingUser.login,
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        position: editingUser.position,
        email: editingUser.email,
        phone: editingUser.phone || '',
        password: '',
        role: editingUser.role as any,
        location_id: editingUser.location_id || 'no-location',
        new_location_name: '',
      });
    } else {
      form.reset({
        login: '',
        first_name: '',
        last_name: '',
        position: '',
        email: '',
        phone: '',
        password: '',
        role: 'ekonom',
        location_id: 'no-location',
        new_location_name: '',
      });
    }
  }, [editingUser, form]);

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

  // Mutacja do tworzenia użytkownika
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      console.log("Tworzenie użytkownika przez administratora/prowincjała...");

      // Opcjonalne utworzenie nowej lokalizacji
      let selectedLocationId: string | null = userData.location_id === 'no-location' ? null : (userData.location_id || null);

      if (isCreatingNewLocation && userData.new_location_name?.trim()) {
        console.log("Tworzenie nowej lokalizacji:", userData.new_location_name);
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .insert({ name: userData.new_location_name.trim() })
          .select('id')
          .maybeSingle();

        if (locationError) {
          console.error("Error creating location:", locationError);
          throw new Error("Nie udało się utworzyć lokalizacji: " + locationError.message);
        }
        if (locationData) {
          selectedLocationId = locationData.id;
          console.log("Lokalizacja utworzona:", selectedLocationId);
        }
      }

      // Dla administratorów i prowincjałów - użyj admin API aby nie wpłynąć na obecną sesję
      const { data: newUserData, error: signUpError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password || 'TempPassword123!',
        user_metadata: {
          full_name: `${userData.first_name} ${userData.last_name}`,
          role: userData.role,
        },
        email_confirm: true
      });

      if (signUpError) {
        console.error("Admin create user error:", signUpError);
        throw new Error(signUpError.message);
      }
      if (!newUserData.user) {
        throw new Error("Nie udało się utworzyć użytkownika");
      }

      console.log("Nowy użytkownik utworzony przez admina:", newUserData.user.id);

      // Utwórz profil użytkownika
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUserData.user.id,
          login: userData.login,
          first_name: userData.first_name,
          last_name: userData.last_name,
          position: userData.position,
          name: `${userData.first_name} ${userData.last_name}`,
          email: userData.email,
          phone: userData.phone,
          role: userData.role,
          location_id: selectedLocationId,
        });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        throw new Error("Nie udało się utworzyć profilu użytkownika");
      }

      console.log("Profil użytkownika utworzony pomyślnie");
      return newUserData;
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

      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('user already registered')) {
        errorMessage = 'Użytkownik z tym adresem email już istnieje';
      } else if (msg.includes('invalid email')) {
        errorMessage = 'Nieprawidłowy adres email';
      } else if (msg.includes('at least 6') || msg.includes('weak password')) {
        errorMessage = 'Hasło jest zbyt słabe (min. 6 znaków)';
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

  // Mutacja do aktualizacji istniejącego użytkownika (bez zmiany hasła)
  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      if (!editingUser) throw new Error('Brak użytkownika do edycji');

      // Opcjonalne utworzenie nowej lokalizacji
      let selectedLocationId: string | null = userData.location_id === 'no-location' ? null : (userData.location_id || null);

      if (isCreatingNewLocation && userData.new_location_name?.trim()) {
        console.log("Tworzenie nowej lokalizacji:", userData.new_location_name);
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .insert({ name: userData.new_location_name.trim() })
          .select('id')
          .maybeSingle();

        if (locationError) {
          console.error("Error creating location:", locationError);
          throw new Error("Nie udało się utworzyć lokalizacji: " + locationError.message);
        }
        if (locationData) {
          selectedLocationId = locationData.id;
          console.log("Lokalizacja utworzona:", selectedLocationId);
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          login: userData.login,
          first_name: userData.first_name,
          last_name: userData.last_name,
          position: userData.position,
          name: `${userData.first_name} ${userData.last_name}`,
          email: userData.email,
          phone: userData.phone,
          role: userData.role,
          location_id: selectedLocationId,
        })
        .eq('id', editingUser.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw new Error('Nie udało się zaktualizować użytkownika: ' + updateError.message);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sukces',
        description: 'Użytkownik został zaktualizowany',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      setIsCreatingNewLocation(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error updating user:', error);
      toast({
        title: 'Błąd',
        description: error?.message || 'Nie udało się zaktualizować użytkownika',
        variant: 'destructive',
      });
    },
  });

  const isSubmitting = createUserMutation.isPending || updateUserMutation.isPending;


  const onSubmit = (data: UserFormData) => {
    console.log("Dane formularza:", data);
    if (editingUser) {
      updateUserMutation.mutate(data);
    } else {
      createUserMutation.mutate(data);
    }
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
          <DialogTitle>
            {editingUser ? 'Edytuj użytkownika' : 'Dodaj nowego użytkownika'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login</FormLabel>
                  <FormControl>
                    <Input placeholder="np. jan.kowalski" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imię</FormLabel>
                    <FormControl>
                      <Input placeholder="Jan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwisko</FormLabel>
                    <FormControl>
                      <Input placeholder="Kowalski" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stanowisko</FormLabel>
                  <FormControl>
                    <Input placeholder="np. Ekonom, Dyrektor" {...field} />
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon (opcjonalny)</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="np. +48 123 456 789" 
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
                    <FormLabel>
                      {editingUser ? 'Nowe hasło (zostaw puste aby nie zmieniać)' : 'Hasło'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={editingUser ? "Zostaw puste aby nie zmieniać" : "Wprowadź hasło (min. 6 znaków)"} 
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
                      <SelectItem value="proboszcz">Proboszcz</SelectItem>
                      <SelectItem value="asystent">Asystent</SelectItem>
                      <SelectItem value="asystent_ekonoma_prowincjalnego">Asystent Ekonoma Prowincjalnego</SelectItem>
                      <SelectItem value="ekonom_prowincjalny">Ekonom Prowincjalny</SelectItem>
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
                        <SelectContent className="max-h-[200px] overflow-y-auto">
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
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting 
                  ? (editingUser ? 'Aktualizacja...' : 'Tworzenie...') 
                  : (editingUser ? 'Zaktualizuj użytkownika' : 'Utwórz użytkownika')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UserDialog;
