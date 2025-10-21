import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const EmailTestManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      toast({
        title: 'Błąd',
        description: 'Nie można wysłać emaila - brak adresu email w profilu użytkownika',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setLastSentAt(new Date());
      
      toast({
        title: 'Email wysłany!',
        description: `Link do resetowania hasła został wysłany na adres: ${user.email}`,
      });
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      toast({
        title: 'Błąd wysyłania',
        description: error.message || 'Nie udało się wysłać emaila z linkiem do resetowania hasła',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Reset hasła
          </CardTitle>
          <CardDescription>
            Wyślij email z linkiem do resetowania hasła
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">Informacja</p>
                <p className="text-sm text-amber-700 mt-1">
                  Kliknij poniższy przycisk, aby wysłać email z linkiem do resetowania hasła na Twój adres: <strong>{user?.email}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Reset hasła dla</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button 
              onClick={handleSendPasswordReset}
              disabled={isSending}
              size="lg"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Wyślij link do resetowania
                </>
              )}
            </Button>
          </div>

          {lastSentAt && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Email wysłany pomyślnie!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Ostatnie wysłanie: {lastSentAt.toLocaleString('pl-PL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Sprawdź swoją skrzynkę pocztową i kliknij link, aby zresetować hasło.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">Informacje o resetowaniu hasła:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Link do resetowania jest ważny przez 1 godzinę</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Po kliknięciu w link zostaniesz przekierowany do strony ustawiania nowego hasła</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Po zresetowaniu hasła stare hasło przestanie działać</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Link może się znaleźć w folderze SPAM - sprawdź również tam</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailTestManagement;
