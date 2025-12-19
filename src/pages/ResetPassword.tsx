import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Hasło musi mieć minimum 8 znaków')
  .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
  .regex(/[A-Z]/, 'Hasło musi zawierać dużą literę')
  .regex(/[0-9]/, 'Hasło musi zawierać cyfrę')
  .regex(/[^a-zA-Z0-9]/, 'Hasło musi zawierać znak specjalny');

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get token from URL
  const token = searchParams.get('token');

  useEffect(() => {
    // If we have a custom token, it's valid (verification happens on submit)
    if (token) {
      setIsValidToken(true);
      setIsCheckingToken(false);
    } else {
      setIsValidToken(false);
      setIsCheckingToken(false);
    }
  }, [token]);

  useEffect(() => {
    // Waliduj hasło w czasie rzeczywistym
    if (newPassword) {
      setPasswordValidation({
        minLength: newPassword.length >= 8,
        hasLowercase: /[a-z]/.test(newPassword),
        hasUppercase: /[A-Z]/.test(newPassword),
        hasNumber: /[0-9]/.test(newPassword),
        hasSpecialChar: /[^a-zA-Z0-9]/.test(newPassword),
      });
    } else {
      setPasswordValidation({
        minLength: false,
        hasLowercase: false,
        hasUppercase: false,
        hasNumber: false,
        hasSpecialChar: false,
      });
    }
  }, [newPassword]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Błąd',
        description: 'Brak tokena resetowania hasła',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Hasła się nie zgadzają',
        description: 'Wprowadzone hasła są różne.',
        variant: 'destructive',
      });
      return;
    }

    // Walidacja z zod
    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      toast({
        title: 'Nieprawidłowe hasło',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    // Sprawdź czy wszystkie wymagania są spełnione
    const allValid = Object.values(passwordValidation).every(v => v === true);
    if (!allValid) {
      toast({
        title: 'Nieprawidłowe hasło',
        description: 'Hasło nie spełnia wszystkich wymagań bezpieczeństwa.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call our custom edge function
      const { data, error } = await supabase.functions.invoke('verify-password-reset', {
        body: {
          token,
          newPassword,
        },
      });

      if (error) {
        throw new Error(error.message || 'Nie udało się zmienić hasła');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Hasło zmienione!',
        description: 'Twoje hasło zostało pomyślnie zmienione. Za chwilę zostaniesz przekierowany do logowania.',
      });

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się zmienić hasła.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <CardTitle>Weryfikacja linku...</CardTitle>
            <CardDescription>Sprawdzanie ważności linku resetowania hasła</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
            <CardTitle>Nieprawidłowy link</CardTitle>
            <CardDescription>
              Link do resetowania hasła jest nieprawidłowy lub wygasł. 
              Poproś administratora o ponowne wysłanie linku resetowania hasła.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
            >
              Wróć do logowania
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Ustaw nowe hasło
          </CardTitle>
          <CardDescription>
            Wprowadź nowe hasło do swojego konta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                Nowe hasło
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Wprowadź nowe hasło"
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Potwierdź hasło
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Potwierdź nowe hasło"
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium text-foreground mb-2">Wymagania dla hasła:</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {passwordValidation.minLength ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.minLength ? 'text-green-600' : 'text-muted-foreground'}>
                    Minimum 8 znaków
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordValidation.hasLowercase ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.hasLowercase ? 'text-green-600' : 'text-muted-foreground'}>
                    Co najmniej jedna mała litera (a-z)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordValidation.hasUppercase ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}>
                    Co najmniej jedna duża litera (A-Z)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordValidation.hasNumber ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                    Co najmniej jedna cyfra (0-9)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordValidation.hasSpecialChar ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-muted-foreground'}>
                    Co najmniej jeden znak specjalny (!@#$%^&*...)
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Zmieniam hasło...
                </>
              ) : (
                'Zmień hasło'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
