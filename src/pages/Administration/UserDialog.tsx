import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
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
  location_ids: z.array(z.string()).default([]),
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
    location_ids?: string[];
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
      location_ids: editingUser?.location_ids || [],
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

  // Pobierz lokalizacje użytkownika przy edycji
  const { data: userLocations } = useQuery({
    queryKey: ['user-locations', editingUser?.id],
    enabled: !!editingUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_locations')
        .select('location_id')
        .eq('user_id', editingUser!.id);
      
      if (error) throw error;
      return data.map(ul => ul.location_id);
    }
  });

  // Reset form when editingUser or userLocations changes
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
        location_ids: userLocations || [],
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
        location_ids: [],
        new_location_name: '',
      });
    }
  }, [editingUser, userLocations, form]);

  // Mutacja do tworzenia użytkownika
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      console.log("Tworzenie użytkownika przez administratora/prowincjała...");

      let selectedLocationIds = [...userData.location_ids];

      // Opcjonalne utworzenie nowej lokalizacji
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
          selectedLocationIds.push(locationData.id);
          console.log("Lokalizacja utworzona:", locationData.id);
        }
      }

      // Wywołaj edge function (działa na kluczu serwisowym, nie zrywa sesji)
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user-admin', {
        body: {
          email: userData.email,
          password: userData.password || '',
          profile: {
            login: userData.login,
            first_name: userData.first_name,
            last_name: userData.last_name,
            position: userData.position,
            name: `${userData.first_name} ${userData.last_name}`,
            email: userData.email,
            phone: userData.phone,
            role: userData.role,
            location_id: selectedLocationIds[0] || null, // Backward compatibility
          },
        },
      });

      const fnBody = fnData as { user_id?: string; error?: string; code?: string } | null;
      const newUserId = fnBody?.user_id;

      // Jeśli funkcja zwróciła błąd w body (HTTP 200) – pokaż go użytkownikowi
      if (fnBody?.error) {
        const errorMessage = String(fnBody.error || '');
        const errorCode = fnBody.code;
        const msg = errorMessage.toLowerCase();

        if (errorCode === 'email_exists' || msg.includes('already been registered')) {
          throw new Error('Użytkownik z tym adresem email już istnieje');
        }
        if (msg.includes('invalid email')) {
          throw new Error('Nieprawidłowy adres email');
        }
        if (msg.includes('weak password') || msg.includes('at least 6')) {
          throw new Error('Hasło jest zbyt słabe (min. 6 znaków)');
        }

        throw new Error(errorMessage || 'Nie udało się utworzyć użytkownika');
      }

      // Twarde błędy HTTP (np. 401/403/500)
      if (fnError) {
        console.error("create-user-admin error:", fnError);
        throw new Error(fnError.message || 'Nie udało się utworzyć użytkownika');
      }

      if (!newUserId) {
        throw new Error("Nie udało się utworzyć użytkownika");
      }

      console.log("Nowy użytkownik utworzony:", newUserId);

      // Dodaj lokalizacje do tabeli user_locations
      if (selectedLocationIds.length > 0) {
        const { error: locError } = await supabase
          .from('user_locations')
          .insert(selectedLocationIds.map(locId => ({
            user_id: newUserId,
            location_id: locId
          })));
        
        if (locError) {
          console.error("Error adding user locations:", locError);
        }
      }

      return { user_id: newUserId };
    },
    onSuccess: () => {
      console.log("Użytkownik utworzony pomyślnie, sprawdzam obecną sesję...");
      // Sprawdź czy obecna sesja nadal jest aktywna
      supabase.auth.getUser().then(({ data: { user }, error }) => {
        console.log("Obecny użytkownik po utworzeniu:", user);
        console.log("Błąd sesji po utworzeniu:", error);
      });
      
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
      toast({
        title: 'Błąd',
        description: error?.message || 'Nie udało się utworzyć użytkownika',
        variant: 'destructive',
      });
    },
  });

  // Mutacja do aktualizacji istniejącego użytkownika (bez zmiany hasła)
  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      if (!editingUser) throw new Error('Brak użytkownika do edycji');

      let selectedLocationIds = [...userData.location_ids];

      // Opcjonalne utworzenie nowej lokalizacji
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
          selectedLocationIds.push(locationData.id);
          console.log("Lokalizacja utworzona:", locationData.id);
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
          location_id: selectedLocationIds[0] || null, // Backward compatibility
        })
        .eq('id', editingUser.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw new Error('Nie udało się zaktualizować użytkownika: ' + updateError.message);
      }

      // Aktualizuj lokalizacje w tabeli user_locations
      // Najpierw usuń stare
      await supabase
        .from('user_locations')
        .delete()
        .eq('user_id', editingUser.id);

      // Potem dodaj nowe
      if (selectedLocationIds.length > 0) {
        const { error: locError } = await supabase
          .from('user_locations')
          .insert(selectedLocationIds.map(locId => ({
            user_id: editingUser.id,
            location_id: locId
          })));
        
        if (locError) {
          console.error("Error updating user locations:", locError);
          throw new Error('Nie udało się zaktualizować lokalizacji');
        }
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingUser ? 'Edytuj użytkownika' : 'Dodaj nowego użytkownika'}
          </DialogTitle>
          <DialogDescription>
            {editingUser ? 'Zmień dane użytkownika systemu.' : 'Wprowadź dane nowego użytkownika systemu.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
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
                <FormLabel>Placówki (opcjonalnie)</FormLabel>
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
                  name="location_ids"
                  render={() => (
                    <FormItem>
                      <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                        {locations?.map((location) => (
                          <FormField
                            key={location.id}
                            control={form.control}
                            name="location_ids"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(location.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, location.id])
                                        : field.onChange(field.value?.filter((value) => value !== location.id))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {location.name}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
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
