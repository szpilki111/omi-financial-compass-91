import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import TwoFactorVerification from '@/components/auth/TwoFactorVerification';
import { 
  generateDeviceFingerprint, 
  isDeviceTrusted, 
  addTrustedDevice,
  updateTrustedDeviceLastUsed 
} from '@/utils/deviceFingerprint';

// Weryfikacja dwuetapowa - WŁĄCZONA
const ENABLE_TWO_FACTOR_AUTH = true;

// Ograniczamy role do ekonoma
type Role = 'ekonom';
interface ProfileInsertParams {
  user_id: string;
  user_name: string;
  user_role: Role;
  user_email: string;
  location_id: string | null;
}
interface Location {
  id: string;
  name: string;
}
const Login = () => {
  const [loginField, setLoginField] = useState(''); // Changed from email to login
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [existingLocations, setExistingLocations] = useState<Location[]>([]);
  const [isCreatingNewLocation, setIsCreatingNewLocation] = useState(false);
  
  // Two-factor authentication states
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string>('');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [twoFactorInProgress, setTwoFactorInProgress] = useState(false);
  
  const {
    login,
    isAuthenticated
  } = useAuth();
  const navigate = useNavigate();
  const location_path = useLocation();
  const {
    toast
  } = useToast();

  // Get the redirect path or use home page as default
  const from = (location_path.state as {
    from?: {
      pathname: string;
    };
  })?.from?.pathname || '/dashboard';

  // Pobieranie istniejących lokalizacji
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('locations').select('id, name').order('name');
        if (error) throw error;
        if (data) setExistingLocations(data);
      } catch (err) {
        console.error('Błąd podczas pobierania lokalizacji:', err);
      }
    };
    if (isSigningUp) {
      fetchLocations();
    }
  }, [isSigningUp]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !twoFactorInProgress) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from, twoFactorInProgress]);

  // Helper function for timeouts
  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Żądanie przekroczyło limit czasu')), ms));
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // Check for any existing session and sign out if found
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
      }

      const userEmail = loginField.trim().toLowerCase();

      // Standardowe logowanie bez 2FA
      if (!ENABLE_TWO_FACTOR_AUTH) {
        const success = await Promise.race([
          login(userEmail, password),
          timeout(10000)
        ]);
        
        if (success) {
          toast({
            title: "Logowanie pomyślne",
            description: "Zostałeś zalogowany do systemu."
          });
          navigate(from, { replace: true });
        } else {
          setError("Nieprawidłowy email lub hasło. Spróbuj ponownie.");
        }
        return;
      }

      // 2FA włączone
      setTwoFactorInProgress(true);

      const fingerprint = await generateDeviceFingerprint();
      setDeviceFingerprint(fingerprint);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, blocked')
        .eq('email', userEmail)
        .maybeSingle();

      if (profileData?.blocked) {
        toast({
          title: "Konto zablokowane",
          description: "Twoje konto zostało zablokowane. Skontaktuj się z administratorem.",
          variant: "destructive",
        });
        setTwoFactorInProgress(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (authError || !authData.user) {
        setError("Nieprawidłowy email lub hasło. Spróbuj ponownie.");
        setTwoFactorInProgress(false);
        return;
      }

      const userId = authData.user.id;
      
      const trusted = await isDeviceTrusted(userId, fingerprint, supabase);
      
      if (trusted) {
        await updateTrustedDeviceLastUsed(userId, fingerprint, supabase);

        toast({
          title: "Logowanie pomyślne",
          description: "Zostałeś zalogowany do systemu.",
        });

        setTwoFactorInProgress(false);
        navigate(from, { replace: true });
        return;
      }

      // Urządzenie niezaufane → wyloguj i przejdź do weryfikacji kodem
      await supabase.auth.signOut({ scope: 'local' });
      
      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-verification-code', {
        body: {
          user_id: userId,
          email: userEmail,
          device_fingerprint: fingerprint,
          user_agent: navigator.userAgent,
        },
      });

      if (sendError) {
        setError('Nie udało się wysłać kodu weryfikacyjnego');
        setTwoFactorInProgress(false);
        return;
      }

      // Obsługa rate limiting (429)
      if (sendData?.error === 'Too many requests') {
        setError('Zbyt wiele prób. Poczekaj chwilę i spróbuj ponownie.');
        setTwoFactorInProgress(false);
        return;
      }

      setPendingUserId(userId);
      setPendingEmail(userEmail);
      setShowTwoFactorDialog(true);
    } catch (err: any) {
      setError(err?.message || "Wystąpił problem podczas logowania. Spróbuj ponownie.");
      setTwoFactorInProgress(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorVerified = async (trustDevice: boolean) => {
    setShowTwoFactorDialog(false);
    setIsLoading(true);

    try {
      if (trustDevice) {
        await addTrustedDevice(pendingUserId, deviceFingerprint, supabase);
      }

      const success = await Promise.race([
        login(pendingEmail, password),
        timeout(10000)
      ]);

      if (success) {
        toast({
          title: "Weryfikacja zakończona pomyślnie",
          description: "Zostałeś zalogowany do systemu."
        });
        setTwoFactorInProgress(false);
        navigate(from, { replace: true });
      } else {
        setError("Nie udało się zalogować po weryfikacji");
        setTwoFactorInProgress(false);
      }
    } catch {
      setError("Wystąpił błąd podczas logowania");
      setTwoFactorInProgress(false);
    } finally {
      setIsLoading(false);
      setPendingUserId('');
      setPendingEmail('');
    }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    if (!name.trim()) {
      setError("Imię i nazwisko jest wymagane");
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków");
      setIsLoading(false);
      return;
    }
    if (isCreatingNewLocation && !location.trim()) {
      setError("Nazwa domu zakonnego jest wymagana");
      setIsLoading(false);
      return;
    }
    if (!isCreatingNewLocation && !locationId) {
      setError("Wybierz lokalizację z listy lub utwórz nową");
      setIsLoading(false);
      return;
    }
    try {
      // Check for any existing session and sign out if found
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session) {
        console.log('Znaleziono aktywną sesję, wylogowuję...', session.user.email);
        await supabase.auth.signOut();
      }
      console.log("Rozpoczynanie procesu rejestracji...");

      // Rejestracja tylko jako ekonom
      const role: Role = 'ekonom';

      // Register user directly - Supabase will check if email exists
      console.log("Tworzenie konta użytkownika...");
      const {
        data,
        error: signUpError
      } = await supabase.auth.signUp({
        email: loginField,
        // using loginField which contains email during signup
        password,
        options: {
          data: {
            full_name: name,
            role: role
          }
        }
      });
      if (signUpError) {
        console.error("Signup error:", signUpError);
        if (signUpError.message.includes("already registered")) {
          setError("Ten email jest już zarejestrowany. Użyj opcji logowania.");
        } else {
          setError(signUpError.message || "Wystąpił błąd podczas rejestracji");
        }
        setIsLoading(false);
        return;
      }
      if (!data.user) {
        console.error("No user returned after signup");
        setError("Błąd podczas rejestracji. Spróbuj ponownie.");
        setIsLoading(false);
        return;
      }
      console.log("Użytkownik utworzony:", data.user.id);

      // Create default location if provided and selected to create new
      let selectedLocationId = locationId;
      if (isCreatingNewLocation && location.trim()) {
        try {
          console.log("Tworzenie nowej lokalizacji:", location);
          const {
            data: locationData,
            error: locationError
          } = await supabase.from('locations').insert({
            name: location
          }).select('id').single();
          if (locationError) {
            console.error("Error creating location:", locationError);
            // Continue with profile creation, but inform about location error
            toast({
              title: "Uwaga",
              description: "Nie udało się dodać lokalizacji: " + locationError.message,
              variant: "destructive"
            });
          } else if (locationData) {
            selectedLocationId = locationData.id;
            console.log("Lokalizacja utworzona:", selectedLocationId);
          }
        } catch (locErr) {
          console.error("Location creation error:", locErr);
          // Continue with profile creation, but inform about location error
          toast({
            title: "Uwaga",
            description: "Wystąpił błąd podczas tworzenia lokalizacji",
            variant: "destructive"
          });
        }
      }

      // Try direct insert to profiles instead of using RPC
      try {
        console.log("Tworzenie profilu użytkownika bezpośrednim zapytaniem...");
        const {
          error: directProfileError
        } = await supabase.from('profiles').insert({
          id: data.user.id,
          name: name,
          role: role,
          email: loginField,
          // using loginField which contains email during signup
          location_id: selectedLocationId
        });
        if (directProfileError) {
          console.error("Error creating profile directly:", directProfileError);

          // As a fallback, try using the RPC method
          console.log("Próba utworzenia profilu przy użyciu RPC...");
          const {
            error: profileError
          } = await supabase.rpc('insert_profile_admin', {
            user_id: data.user.id,
            user_name: name,
            user_role: role,
            user_email: loginField,
            // using loginField which contains email during signup
            location_id: selectedLocationId
          } as ProfileInsertParams);
          if (profileError) {
            console.error("Error creating profile via RPC:", profileError);
            setError("Konto zostało utworzone, ale wystąpił błąd podczas tworzenia profilu. Skontaktuj się z administratorem.");
            setIsLoading(false);
            return;
          }
        }
      } catch (profileErr) {
        console.error("Profile creation error:", profileErr);
        setError("Konto utworzono, ale wystąpił błąd podczas tworzenia profilu. Skontaktuj się z administratorem.");
        setIsLoading(false);
        return;
      }
      console.log("Rejestracja zakończona pomyślnie");

      // Try to login automatically with timeout protection
      try {
        const success = await Promise.race([login(loginField, password), timeout(10000) // 10 second timeout
        ]);
        if (success) {
          toast({
            title: "Rejestracja udana",
            description: "Konto zostało utworzone. Jesteś teraz zalogowany.",
            duration: 5000
          });
          navigate(from, {
            replace: true
          });
        } else {
          toast({
            title: "Rejestracja udana",
            description: "Konto zostało utworzone, ale nie udało się zalogować automatycznie. Możesz zalogować się ręcznie.",
            duration: 5000
          });
          setIsSigningUp(false);
        }
      } catch (loginErr) {
        console.error("Error during auto-login:", loginErr);
        toast({
          title: "Rejestracja udana",
          description: "Konto zostało utworzone, ale nie udało się zalogować automatycznie. Możesz zalogować się ręcznie.",
          duration: 5000
        });
        setIsSigningUp(false);
      }

      // Clear form
      setLoginField('');
      setPassword('');
      setName('');
      setLocation('');
      setLocationId(null);
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err?.message || "Wystąpił problem podczas rejestracji. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };
  return <>
    <TwoFactorVerification
      isOpen={showTwoFactorDialog}
      onClose={() => {
        setShowTwoFactorDialog(false);
        setPendingUserId('');
        setPendingEmail('');
        setTwoFactorInProgress(false);
      }}
      onVerified={handleTwoFactorVerified}
      userId={pendingUserId}
      email={pendingEmail}
      deviceFingerprint={deviceFingerprint}
    />
    
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <div className="bg-white p-8 rounded-md shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-omi-500">OMI Finanse</h1>
          <p className="text-omi-gray-500 mt-1">
            {isSigningUp ? 'Utwórz nowe konto ekonoma' : 'Zaloguj się do systemu'}
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
            {error}
          </div>}

        <form onSubmit={isSigningUp ? handleSignUp : handleSubmit} className="space-y-4">
          {isSigningUp && <div>
              <Label htmlFor="name" className="omi-form-label">
                Imię i nazwisko
              </Label>
              <Input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className="omi-form-input" required placeholder="Wprowadź imię i nazwisko" />
            </div>}
          
          <div>
            <Label htmlFor="login" className="omi-form-label">
              Adres email
            </Label>
            <Input id="login" type="email" value={loginField} onChange={e => setLoginField(e.target.value)} className="omi-form-input" required placeholder="Wprowadź adres email" />
          </div>

          <div>
            <Label htmlFor="password" className="omi-form-label">
              Hasło
            </Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="omi-form-input" required placeholder={isSigningUp ? "Min. 6 znaków" : "Wprowadź hasło"} />
          </div>

          {isSigningUp && <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="location-select" className="omi-form-label">
                    Dom zakonny
                  </Label>
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-omi-500 h-6 px-2" onClick={() => setIsCreatingNewLocation(!isCreatingNewLocation)}>
                    {isCreatingNewLocation ? "Wybierz istniejący" : "Utwórz nowy"}
                  </Button>
                </div>
                
                {isCreatingNewLocation ? <Input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} className="omi-form-input" required placeholder="Nazwa nowego domu zakonnego" /> : <Select value={locationId || ''} onValueChange={setLocationId}>
                    <SelectTrigger id="location-select" className="w-full">
                      <SelectValue placeholder="Wybierz dom zakonny" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>}
              </div>
            </>}

          {!isSigningUp && <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember-me" type="checkbox" className="h-4 w-4 border-omi-gray-300 rounded text-omi-500 focus:ring-omi-500" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-omi-gray-700">
                  Zapamiętaj mnie
                </label>
              </div>

              <div>
                <a href="#" className="text-sm text-omi-500 hover:text-omi-600">
                  Zapomniałeś hasła?
                </a>
              </div>
            </div>}

          <Button type="submit" disabled={isLoading} className="omi-btn omi-btn-primary w-full flex justify-center">
            {isLoading ? <Spinner size="sm" /> : isSigningUp ? 'Zarejestruj się' : 'Zaloguj się'}
          </Button>

          <div className="text-center mt-4">
            <p className="text-sm text-omi-gray-600">
              {isSigningUp ? "Masz już konto? " : "Nie masz konta? "}
              <button
                type="button"
                onClick={() => setIsSigningUp(!isSigningUp)}
                className="text-omi-500 hover:text-omi-600 font-medium"
              >
                {isSigningUp ? "Zaloguj się" : "Zarejestruj się"}
              </button>
            </p>
          </div>
        </form>

      </div>
    </div>
  </>;
};
export default Login;