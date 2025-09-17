import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, UserPlus } from "lucide-react";

export function CreateAdminButton() {
  const [isCreating, setIsCreating] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const { toast } = useToast();

  const handleCreateAdmin = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin');

      if (error) {
        throw error;
      }

      if (data.success) {
        setAdminCredentials(data.credentials);
        toast({
          title: "Sukces!",
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się utworzyć administratora",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Utwórz Administratora
        </CardTitle>
        <CardDescription>
          Stwórz konto administratora do zarządzania systemem
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!adminCredentials ? (
          <Button 
            onClick={handleCreateAdmin} 
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? "Tworzenie..." : "Utwórz Administratora"}
          </Button>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Administrator został utworzony!</p>
                <div className="bg-muted p-3 rounded-md">
                  <p><strong>Email:</strong> {adminCredentials.email}</p>
                  <p><strong>Hasło:</strong> {adminCredentials.password}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Zaloguj się używając powyższych danych, a następnie możesz wykonać import bazy danych.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}