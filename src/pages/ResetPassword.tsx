import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    noEmailParts: true,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, 'Session:', session?.user?.email);
        
        if (event === 'PASSWORD_RECOVERY') {
          console.log('Password recovery event detected');
          if (isMounted) {
            setIsValidToken(true);
            setIsCheckingToken(false);
            if (session?.user?.email) {
              setUserEmail(session.user.email);
            }
          }
        } else if (event === 'SIGNED_IN' && session) {
          // Check if this is a recovery session by looking at the URL hash
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get('type');
          
          if (type === 'recovery') {
            console.log('Recovery session from URL hash');
            if (isMounted) {
              setIsValidToken(true);
              setIsCheckingToken(false);
              if (session.user?.email) {
                setUserEmail(session.user.email);
              }
            }
          }
        }
      }
    );

    // Also check current session and URL hash
    const checkSession = async () => {
      // Check URL hash for recovery token
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      console.log('Checking URL hash - type:', type, 'has token:', !!accessToken);

      if (type === 'recovery' && accessToken) {
        // Token is in URL, Supabase will process it
        console.log('Recovery token found in URL, waiting for Supabase to process...');
        // Give Supabase more time to process the token
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          console.log('Session established after token processing');
          setIsValidToken(true);
          setUserEmail(session.user.email || '');
          setIsCheckingToken(false);
          return;
        }
      }

      // Check if there's already a valid session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session?.user?.email);
      
      if (session?.user && isMounted) {
        // If user has a session on reset-password page, allow them to change password
        setIsValidToken(true);
        setUserEmail(session.user.email || '');
        setIsCheckingToken(false);
        return;
      }

      // No valid recovery token found after waiting - but don't redirect, let user see the error
      setTimeout(() => {
        if (isMounted && !isValidToken) {
          setIsCheckingToken(false);
        }
      }, 3000);
    };

    checkSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Waliduj hasło w czasie rzeczywistym
    if (newPassword) {
      const emailParts = userEmail.split('@')[0].toLowerCase().split(/[._-]/);
      const passwordLower = newPassword.toLowerCase();
      
      setPasswordValidation({
        minLength: newPassword.length >= 8,
        hasLowercase: /[a-z]/.test(newPassword),
        hasUppercase: /[A-Z]/.test(newPassword),
        hasNumber: /[0-9]/.test(newPassword),
        hasSpecialChar: /[^a-zA-Z0-9]/.test(newPassword),
        noEmailParts: !emailParts.some(part => 
          part.length >= 3 && passwordLower.includes(part)
        ),
      });
    } else {
      setPasswordValidation({
        minLength: false,
        hasLowercase: false,
        hasUppercase: false,
        hasNumber: false,
        hasSpecialChar: false,
        noEmailParts: true,
      });
    }
  }, [newPassword, userEmail]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

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

    // Sprawdź czy hasło nie zawiera fragmentów loginu
    const emailParts = userEmail.split('@')[0].toLowerCase().split(/[._-]/);
    const passwordLower = newPassword.toLowerCase();
    const containsEmailPart = emailParts.some(part => 
      part.length >= 3 && passwordLower.includes(part)
    );

    if (containsEmailPart) {
      toast({
        title: 'Nieprawidłowe hasło',
        description: 'Hasło nie może zawierać fragmentów Twojego adresu email.',
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

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
                  minLength={6}
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
                  minLength={6}
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
                <div className="flex items-center gap-2">
                  {passwordValidation.noEmailParts ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.noEmailParts ? 'text-green-600' : 'text-muted-foreground'}>
                    Nie zawiera fragmentów adresu email
                  </span>
                </div>
              </div>
              <div className="pt-2 mt-2 border-t border-border">
                <p className="text-xs text-amber-600 flex items-start gap-1">
                  <span className="font-bold">!</span>
                  <span>Hasło nie może być jednym z 3 ostatnich użytych haseł</span>
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
