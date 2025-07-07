
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
import { Switch } from '@/components/ui/switch';
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
  allow_foreign_currencies: boolean;
}

interface LocationSettingsDialogProps {
  location: Location | null;
  isOpen: boolean;
  onClose: (saved: boolean) => void;
}

interface LocationSettingFormData {
  house_abbreviation: string;
  allow_foreign_currencies: boolean;
}

const LocationSettingsDialog: React.FC<LocationSettingsDialogProps> = ({
  location,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pobierz istniejące ustawienia lokalizacji
  const { data: locationSetting, isLoading } = useQuery({
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

  const form = useForm<LocationSettingFormData>({
    defaultValues: {
      house_abbreviation: '',
      allow_foreign_currencies: false,
    },
  });

  // Reset form when location or settings change
  React.useEffect(() => {
    if (isOpen && !isLoading) {
      form.reset({
        house_abbreviation: locationSetting?.house_abbreviation || '',
        allow_foreign_currencies: locationSetting?.allow_foreign_currencies || false,
      });
    }
  }, [locationSetting, isOpen, isLoading, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: LocationSettingFormData) => {
      if (!location?.id) throw new Error('Brak ID lokalizacji');

      if (locationSetting) {
        // Aktualizacja istniejących ustawień
        const { error } = await supabase
          .from('location_settings')
          .update({
            house_abbreviation: data.house_abbreviation,
            allow_foreign_currencies: data.allow_foreign_currencies,
          })
          .eq('id', locationSetting.id);

        if (error) throw error;
      } else {
        // Tworzenie nowych ustawień
        const { error } = await supabase
          .from('location_settings')
          .insert({
            location_id: location.id,
            house_abbreviation: data.house_abbreviation,
            allow_foreign_currencies: data.allow_foreign_currencies,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-setting'] });
      queryClient.invalidateQueries({ queryKey: ['location-settings'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({
        title: "Sukces",
        description: "Ustawienia placówki zostały zapisane.",
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

  const handleSubmit = (data: LocationSettingFormData) => {
    if (!data.house_abbreviation.trim()) {
      toast({
        title: "Błąd",
        description: "Skrót domu nie może być pusty",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data);
  };

  const handleCancel = () => {
    onClose(false);
  };

  if (!location) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Ustawienia placówki: {location.name}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="house_abbreviation"
              rules={{ 
                required: 'Skrót domu jest wymagany',
                maxLength: { value: 10, message: 'Skrót może mieć maksymalnie 10 znaków' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skrót domu</FormLabel>
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
              name="allow_foreign_currencies"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Zezwolenie na waluty zagraniczne
                    </FormLabel>
                    <div className="text-sm text-gray-500">
                      Pozwala placówce na tworzenie dokumentów w walutach innych niż PLN
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
                  : 'Zapisz ustawienia'
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default LocationSettingsDialog;
