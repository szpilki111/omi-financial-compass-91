
import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
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

interface LocationDialogProps {
  location: Location | null;
  isOpen: boolean;
  onClose: (saved: boolean) => void;
}

interface LocationFormData {
  name: string;
  address: string;
}

const LocationDialog: React.FC<LocationDialogProps> = ({
  location,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const isEditing = !!location;

  const form = useForm<LocationFormData>({
    defaultValues: {
      name: location?.name || '',
      address: location?.address || '',
    },
  });

  // Reset form when location changes
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        name: location?.name || '',
        address: location?.address || '',
      });
    }
  }, [location, isOpen, form]);

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
      } else {
        // Dodawanie nowej placówki
        const { error } = await supabase
          .from('locations')
          .insert({
            name: data.name,
            address: data.address || null,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
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
