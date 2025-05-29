
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

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ekonom',
      location_id: 'no-location',
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

  // Mutacja do tworzenia użytkownika używając Supabase Auth (jak w rejestracji)
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      const locationId = userData.location_id === 'no-location' ? null : userData.location_id;
      
      // Krok 1: Utwórz użytkownika w Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role,
          }
        }
      });

      if (authError) throw authError;

      // Krok 2: Jeśli użytkownik został utworzony, zaktualizuj profil
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: userData.name,
            role: userData.role,
            location_id: locationId,
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          // Nie rzucamy błędem, bo użytkownik został utworzony
        }
      }

      return authData;
    },
    onSuccess: () => {
      toast({
        title: 'Sukces',
        description: 'Użytkownik został utworzony pomyślnie',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error creating user:', error);
      let errorMessage = 'Nie udało się utworzyć użytkownika';
      
      // Mapowanie błędów Supabase na bardziej przyjazne komunikaty
      if (error.message?.includes('User already registered')) {
        errorMessage = 'Użytkownik z tym adresem email już istnieje';
      } else if (error.message?.includes('invalid email')) {
        errorMessage = 'Nieprawidłowy adres email';
      } else if (error.message?.includes('weak password')) {
        errorMessage = 'Hasło jest zbyt słabe';
      } else if (error.message?.includes('signup_disabled')) {
        errorMessage = 'Rejestracja jest wyłączona';
      }
      
      toast({
        title: 'Błąd',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
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
                      placeholder="Wprowadź hasło" 
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

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Placówka (opcjonalnie)</FormLabel>
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
