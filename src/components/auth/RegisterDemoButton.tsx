
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const RegisterDemoButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSetupDemoData = async () => {
    setIsLoading(true);
    
    try {
      // Wywołanie funkcji Edge w Supabase do utworzenia przykładowych danych
      const { data, error } = await supabase.functions.invoke('setup-demo-data');
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({
        title: "Sukces!",
        description: "Przykładowe dane zostały utworzone. Możesz teraz zalogować się jako admin@omi.pl, prowincjal@omi.pl lub jako ekonom placówki.",
        duration: 10000,
      });
      
      console.log("Odpowiedź funkcji setup-demo-data:", data);
    } catch (error: any) {
      console.error('Błąd podczas konfigurowania danych demo:', error);
      toast({
        title: "Wystąpił błąd",
        description: error.message || "Nie udało się skonfigurować danych demonstracyjnych",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSetupDemoData} 
      disabled={isLoading}
      variant="outline"
      className="mt-4 w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Konfigurowanie danych...
        </>
      ) : "Skonfiguruj dane demonstracyjne"}
    </Button>
  );
};

export default RegisterDemoButton;
