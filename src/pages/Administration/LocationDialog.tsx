
import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast';

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface LocationSetting {
  id: string;
  location_id: string;
  house_abbreviation: string;
}

interface LocationDialogProps {
  location: Location | null;
  isOpen: boolean;
  onClose: (saved: boolean) => void;
}

interface LocationFormData {
  name: string;
  address: string;
  house_abbreviation: string;
}

const LocationDialog: React.FC<LocationDialogProps> = ({
  location,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!location;

  // Pobierz istniejące ustawienia lokalizacji
  const { data: locationSetting, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['location-setting', location?.id],
    queryFn: async () => {
      if (!location?.id) return null;
      
      const { data, error } = await supabase
        .from('location_settings')
        .select('*')
        .eq('location_id', location.id)
        .maybeSingle();

      if (error) throw error;
      return data as LocationSetting | null;
    },
    enabled: !!location?.id && isOpen,
  });

  const form = useForm<LocationFormData>({
    defaultValues: {
      name: '',
      address: '',
      house_abbreviation: '',
    },
  });

  // Reset form when location or settings change
  React.useEffect(() => {
    if (isOpen && !isLoadingSettings) {
      form.reset({
        name: location?.name || '',
        address: location?.address || '',
        house_abbreviation: locationSetting?.house_abbreviation || '',
      });
    }
  }, [location, locationSetting, isOpen, isLoadingSettings, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      if (isEditing && location) {
        // Edytowanie istniejącej placówki
        const { error } = await supabase
          .from('locations')
          .update({
            name: data.name,
            address: data.address || null,
          })
          .eq('id', location.id);

        if (error) throw error;

        // Zapisz lub zaktualizuj ustawienia skrótu domu
        if (data.house_abbreviation.trim()) {
          if (locationSetting) {
            // Aktualizacja istniejących ustawień
            const { error: settingsError } = await supabase
              .from('location_settings')
              .update({
                house_abbreviation: data.house_abbreviation.trim(),
              })
              .eq('id', locationSetting.id);

            if (settingsError) throw settingsError;
          } else {
            // Tworzenie nowych ustawień
            const { error: settingsError } = await supabase
              .from('location_settings')
              .insert({
                location_id: location.id,
                house_abbreviation: data.house_abbreviation.trim(),
              });

            if (settingsError) throw settingsError;
          }
        } else if (locationSetting) {
          // Usuń ustawienia jeśli skrót jest pusty
          const { error: deleteError } = await supabase
            .from('location_settings')
            .delete()
            .eq('id', locationSetting.id);

          if (deleteError) throw deleteError;
        }
      } else {
        // Dodawanie nowej placówki
        const { data: newLocation, error } = await supabase
          .from('locations')
          .insert({
            name: data.name,
            address: data.address || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Dodaj ustawienia skrótu domu jeśli podano
        if (data.house_abbreviation.trim()) {
          const { error: settingsError } = await supabase
            .from('location_settings')
            .insert({
              location_id: newLocation.id,
              house_abbreviation: data.house_abbreviation.trim(),
            });

          if (settingsError) throw settingsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['location-setting'] });
      toast({
        title: "Sukces",
        description: isEditing
          ? "Placówka została zaktualizowana."
          : "Nowa placówka została dodana.",
      });
      onClose(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: LocationFormData) => {
    saveMutation.mutate(data);
  };

  const handleCancel = () => {
    onClose(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edytuj placówkę' : 'Dodaj nową placówkę'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: 'Nazwa placówki jest wymagana' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nazwa placówki</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. Dom Zakonny Poznań"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres (opcjonalny)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. ul. Przykładowa 123, Poznań"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="house_abbreviation"
              rules={{ 
                maxLength: { value: 10, message: 'Skrót może mieć maksymalnie 10 znaków' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skrót domu (opcjonalny)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. POZ, WAR, KRA"
                      {...field}
                      maxLength={10}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500">
                    Skrót używany do identyfikacji placówki (max. 10 znaków)
                  </p>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? 'Zapisywanie...'
                  : isEditing
                  ? 'Zapisz zmiany'
                  : 'Dodaj placówkę'
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default LocationDialog;
