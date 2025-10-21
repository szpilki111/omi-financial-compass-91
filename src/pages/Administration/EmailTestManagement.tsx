import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/utils/emailUtils';

const EmailTestManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  const handleSendTestEmail = async () => {
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
      const currentDate = new Date().toLocaleString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background-color: #d97706;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 5px 5px;
              }
              .success-icon {
                text-align: center;
                font-size: 48px;
                color: #059669;
                margin: 20px 0;
              }
              .info-box {
                background-color: #fff;
                padding: 15px;
                margin-top: 15px;
                border-left: 4px solid #d97706;
                border-radius: 3px;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>System Finansowy OMI</h1>
              </div>
              <div class="content">
                <div class="success-icon">✅</div>
                <h2 style="text-align: center;">Szczęść Boże ${user.name}!</h2>
                <p style="text-align: center; font-size: 18px; color: #059669;">
                  <strong>System wysyłania emaili działa poprawnie!</strong>
                </p>
                
                <div class="info-box">
                  <p><strong>Data wysłania:</strong> ${currentDate}</p>
                  <p><strong>Odbiorca:</strong> ${user.email}</p>
                  <p><strong>Nadawca:</strong> finanse@oblaci.pl</p>
                </div>
                
                <p style="margin-top: 20px;">
                  To jest testowa wiadomość email z Systemu Finansowego OMI. 
                  Jeśli widzisz tę wiadomość, oznacza to, że konfiguracja serwera SMTP 
                  została wykonana poprawnie i system może wysyłać powiadomienia.
                </p>
                
                <p>
                  System może teraz wysyłać automatyczne powiadomienia o:
                </p>
                <ul>
                  <li>Zmianach statusów raportów</li>
                  <li>Kodach weryfikacyjnych (2FA)</li>
                  <li>Innych ważnych wydarzeniach w systemie</li>
                </ul>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} System Finansowy OMI</p>
                <p>Misjonarze Oblaci Maryi Niepokalanej</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const text = `
Szczęść Boże ${user.name}!

✅ System wysyłania emaili działa poprawnie!

Data wysłania: ${currentDate}
Odbiorca: ${user.email}
Nadawca: finanse@oblaci.pl

To jest testowa wiadomość email z Systemu Finansowego OMI. 
Jeśli widzisz tę wiadomość, oznacza to, że konfiguracja serwera SMTP 
została wykonana poprawnie i system może wysyłać powiadomienia.

System może teraz wysyłać automatyczne powiadomienia o:
- Zmianach statusów raportów
- Kodach weryfikacyjnych (2FA)
- Innych ważnych wydarzeniach w systemie

---
© ${new Date().getFullYear()} System Finansowy OMI
Misjonarze Oblaci Maryi Niepokalanej
      `;

      await sendEmail({
        to: user.email,
        subject: '✅ System Finansowy OMI - Test wysyłania emaili',
        text,
        html,
      });

      setLastSentAt(new Date());
      
      toast({
        title: 'Email wysłany!',
        description: `Testowy email został wysłany na adres: ${user.email}`,
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Błąd wysyłania',
        description: error.message || 'Nie udało się wysłać testowego emaila',
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
            Test systemu wysyłania emaili
          </CardTitle>
          <CardDescription>
            Sprawdź poprawność konfiguracji serwera SMTP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">Informacja</p>
                <p className="text-sm text-amber-700 mt-1">
                  Kliknij poniższy przycisk, aby wysłać testowy email na Twój adres: <strong>{user?.email}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Serwer SMTP</p>
              <p className="text-sm text-muted-foreground">mail.oblaci.pl (finanse@oblaci.pl)</p>
            </div>
            <Button 
              onClick={handleSendTestEmail}
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
                  Wyślij testowy email
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
                    Ostatni test: {lastSentAt.toLocaleString('pl-PL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Sprawdź swoją skrzynkę pocztową (może się znaleźć w folderze SPAM).
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">Możliwości systemu emailowego:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Automatyczne powiadomienia o zmianach statusów raportów</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Wysyłanie kodów weryfikacyjnych przy logowaniu (2FA)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Powiadomienia dla ekonomów o zatwierdzonych/odrzuconych raportach</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>Przypomnienia o terminach składania raportów</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailTestManagement;
