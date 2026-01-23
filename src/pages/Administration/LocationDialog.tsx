
import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  nip: string | null;
  regon: string | null;
  postal_code?: string | null;
  city?: string | null;
  bank_account?: string | null;
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
  location_identifier: string;
  nip: string;
  regon: string;
  postal_code: string;
  city: string;
  bank_account: string;
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
      location_identifier: '',
      nip: '',
      regon: '',
      postal_code: '',
      city: '',
      bank_account: '',
    },
  });

  // Reset form when location or settings change
  React.useEffect(() => {
    if (isOpen && !isLoadingSettings) {
      form.reset({
        name: location?.name || '',
        address: location?.address || '',
        house_abbreviation: locationSetting?.house_abbreviation || '',
        location_identifier: (location as any)?.location_identifier || '',
        nip: location?.nip || '',
        regon: location?.regon || '',
        postal_code: location?.postal_code || '',
        city: location?.city || '',
        bank_account: location?.bank_account || '',
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
            location_identifier: data.location_identifier || null,
            nip: data.nip || null,
            regon: data.regon || null,
            postal_code: data.postal_code || null,
            city: data.city || null,
            bank_account: data.bank_account || null,
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
            location_identifier: data.location_identifier || null,
            nip: data.nip || null,
            regon: data.regon || null,
            postal_code: data.postal_code || null,
            city: data.city || null,
            bank_account: data.bank_account || null,
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
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edytuj placówkę' : 'Dodaj nową placówkę'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Zmień dane placówki.' : 'Wprowadź dane nowej placówki.'}
          </DialogDescription>
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
              name="nip"
              rules={{ 
                pattern: { 
                  value: /^[0-9]{10}$/, 
                  message: 'NIP musi składać się z 10 cyfr' 
                } 
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIP (opcjonalny)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. 1234567890"
                      {...field}
                      maxLength={10}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regon"
              rules={{ 
                pattern: { 
                  value: /^[0-9]{9}([0-9]{5})?$/, 
                  message: 'REGON musi składać się z 9 lub 14 cyfr' 
                } 
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>REGON (opcjonalny)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. 123456789 lub 12345678901234"
                      {...field}
                      maxLength={14}
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

            <FormField
              control={form.control}
              name="location_identifier"
              rules={{ 
                pattern: { 
                  value: /^[0-9]+(-[0-9]+)?$/, 
                  message: 'Identyfikator może składać się tylko z cyfr i myślników (np. "3" lub "3-13")' 
                }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identyfikator placówki (opcjonalny)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. 3-13, 5-6, 7"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Identyfikator używany do automatycznego przypisywania kont (np. konto "210-3-13" będzie widoczne dla placówki z identyfikatorem "3-13")
                  </p>
                </FormItem>
              )}
            />

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3">Dane do raportu miesięcznego</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="postal_code"
                rules={{ 
                  pattern: { 
                    value: /^[0-9]{2}-[0-9]{3}$/, 
                    message: 'Kod pocztowy musi mieć format XX-XXX' 
                  } 
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kod pocztowy</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="np. 38-500"
                        {...field}
                        maxLength={6}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Miasto</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="np. Sanok"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bank_account"
              rules={{ 
                pattern: { 
                  value: /^[0-9\s]{26,32}$/, 
                  message: 'Numer konta musi składać się z 26 cyfr' 
                } 
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numer konta bankowego prowincji</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="np. 12 3456 7890 1234 5678 9012 3456"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Numer konta wyświetlany w stopce raportu miesięcznego
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
