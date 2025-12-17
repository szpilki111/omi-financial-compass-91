import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, Clock, RefreshCw } from 'lucide-react';

interface TwoFactorVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (trustDevice: boolean) => void;
  userId: string;
  email: string;
  deviceFingerprint: string;
}

const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({
  isOpen,
  onClose,
  onVerified,
  userId,
  email,
  deviceFingerprint,
}) => {
  const [code, setCode] = useState('');
  // Domyślnie ufamy urządzeniu po poprawnym wpisaniu kodu (user może odznaczyć)
  const [trustDevice, setTrustDevice] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minut w sekundach
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setError('Kod weryfikacyjny wygasł. Wyślij nowy kod.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Wprowadź 6-cyfrowy kod');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const codeNormalized = code.replace(/\D/g, '').slice(0, 6);

      const { data, error: verifyError } = await supabase.functions.invoke(
        'verify-verification-code',
        {
          body: {
            user_id: userId,
            device_fingerprint: deviceFingerprint,
            code: codeNormalized,
          },
        }
      );

      if (verifyError) {
        setError('Wystąpił błąd podczas weryfikacji. Spróbuj ponownie.');
        return;
      }

      if (!data?.valid) {
        // Rozróżnij powód błędu
        const reason = data?.reason;
        if (reason === 'expired') {
          setError('Kod weryfikacyjny wygasł. Wyślij nowy kod.');
        } else if (reason === 'already_used') {
          setError('Ten kod został już użyty. Wyślij nowy kod.');
        } else {
          setError('Nieprawidłowy kod weryfikacyjny. Sprawdź i spróbuj ponownie.');
        }
        return;
      }

      toast({
        title: "Weryfikacja zakończona pomyślnie",
        description: "Zalogowano do systemu",
      });

      onVerified(trustDevice);
    } catch (error: any) {
      setError('Wystąpił błąd podczas weryfikacji');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError('');
    setTimeLeft(15 * 60);

    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: {
          user_id: userId,
          email,
          device_fingerprint: deviceFingerprint,
          user_agent: navigator.userAgent,
        },
      });

      if (error) throw error;

      // Obsługa rate limiting (429)
      if (data?.error === 'Too many requests') {
        setError('Zbyt wiele prób. Poczekaj minutę i spróbuj ponownie.');
        return;
      }

      toast({
        title: "Kod wysłany ponownie",
        description: "Sprawdź swoją skrzynkę email",
      });
    } catch {
      setError('Nie udało się wysłać kodu ponownie');
    } finally {
      setIsResending(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (error) setError('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Weryfikacja dwuetapowa
          </DialogTitle>
          <DialogDescription>
            Wysłaliśmy 6-cyfrowy kod weryfikacyjny na adres email: <strong>{email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Kod weryfikacyjny</Label>
            <Input
              id="verification-code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={handleCodeChange}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Ważny przez: {formatTime(timeLeft)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendCode}
              disabled={isResending || timeLeft > 14 * 60}
              className="text-primary"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                'Wyślij ponownie'
              )}
            </Button>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked as boolean)}
            />
            <Label
              htmlFor="trust-device"
              className="text-sm font-normal cursor-pointer"
            >
              Dodaj to urządzenie do zaufanych (nie pytaj ponownie)
            </Label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isVerifying}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6 || timeLeft === 0}
              className="flex-1"
            >
              {isVerifying ? 'Weryfikacja...' : 'Zweryfikuj'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorVerification;
