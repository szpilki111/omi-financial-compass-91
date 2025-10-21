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
  const [sentResults, setSentResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);

  const targetEmails = ['admin@oblaci.net', 'crmoblaci@gmail.com'];

  const handleSendPasswordReset = async () => {
    setIsSending(true);
    setSentResults([]);

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of targetEmails) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
          results.push({ email, success: false, error: error.message });
        } else {
          results.push({ email, success: true });
        }
      } catch (error: any) {
        console.error(`Error sending password reset email to ${email}:`, error);
        results.push({ email, success: false, error: error.message });
      }
    }

    setSentResults(results);
    setLastSentAt(new Date());
    setIsSending(false);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0 && failCount === 0) {
      toast({
        title: 'Emaile wysłane!',
        description: `Link do resetowania hasła został wysłany na ${successCount} ${successCount === 1 ? 'adres' : 'adresy'}.`,
      });
    } else if (successCount > 0 && failCount > 0) {
      toast({
        title: 'Częściowy sukces',
        description: `Wysłano ${successCount} z ${results.length} emaili. Sprawdź szczegóły poniżej.`,
        variant: 'default',
      });
    } else {
      toast({
        title: 'Błąd wysyłania',
        description: 'Nie udało się wysłać żadnego emaila. Sprawdź szczegóły poniżej.',
        variant: 'destructive',
      });
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
                  Kliknij poniższy przycisk, aby wysłać email z linkiem do resetowania hasła na następujące adresy:
                </p>
                <ul className="text-sm text-amber-700 mt-2 list-disc list-inside">
                  {targetEmails.map(email => (
                    <li key={email}><strong>{email}</strong></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="font-medium">Reset hasła dla użytkowników:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {targetEmails.map(email => (
                    <li key={email}>• {email}</li>
                  ))}
                </ul>
              </div>
              <Button 
                onClick={handleSendPasswordReset}
                disabled={isSending}
                size="lg"
                className="w-full"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Wyślij linki do resetowania
                  </>
                )}
              </Button>
            </div>
          </div>

          {sentResults.length > 0 && (
            <div className="space-y-3">
              <div className="bg-muted border rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Wyniki wysyłania</p>
                    {lastSentAt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Ostatnie wysłanie: {lastSentAt.toLocaleString('pl-PL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {sentResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.success
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            result.success ? 'text-green-900' : 'text-red-900'
                          }`}>
                            {result.email}
                          </p>
                          <p className={`text-xs mt-1 ${
                            result.success ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {result.success
                              ? 'Link do resetowania hasła został wysłany pomyślnie'
                              : `Błąd: ${result.error}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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
