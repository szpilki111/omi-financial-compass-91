
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Role = 'ekonom' | 'prowincjal' | 'admin';

interface ProfileInsertParams {
  user_id: string;
  user_name: string;
  user_role: Role;
  user_email: string;
  location_id: string | null;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [role, setRole] = useState<Role>('ekonom');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location_path = useLocation();
  const { toast } = useToast();

  // Get the redirect path or use home page as default
  const from = (location_path.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Helper function for timeouts
  const timeout = (ms: number) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Żądanie przekroczyło limit czasu')), ms)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check for any existing session and sign out if found
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Znaleziono aktywną sesję, wylogowuję...', session.user.email);
        await supabase.auth.signOut();
      }

      console.log("Próba logowania dla:", email);
      
      // Add timeout to prevent indefinite loading
      const success = await Promise.race([
        login(email, password),
        timeout(10000) // 10 second timeout
      ]);
      
      if (success) {
        toast({
          title: "Logowanie pomyślne",
          description: "Zostałeś zalogowany do systemu.",
        });
        navigate(from, { replace: true });
      } else {
        setError("Nieprawidłowy email lub hasło. Spróbuj ponownie.");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err?.message || "Wystąpił problem podczas logowania. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
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

    try {
      // Check for any existing session and sign out if found
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Znaleziono aktywną sesję, wylogowuję...', session.user.email);
        await supabase.auth.signOut();
      }

      console.log("Rozpoczynanie procesu rejestracji...");
      
      // Register user directly - Supabase will check if email exists
      console.log("Tworzenie konta użytkownika...");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
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

      // Create default location if provided
      let locationId = null;
      if (location.trim()) {
        try {
          console.log("Tworzenie lokalizacji:", location);
          const { data: locationData, error: locationError } = await supabase
            .from('locations')
            .insert({
              name: location,
            })
            .select('id')
            .single();

          if (locationError) {
            console.error("Error creating location:", locationError);
            // Continue with profile creation, but inform about location error
            toast({
              title: "Uwaga",
              description: "Nie udało się dodać lokalizacji: " + locationError.message,
              variant: "destructive",
            });
          } else if (locationData) {
            locationId = locationData.id;
            console.log("Lokalizacja utworzona:", locationId);
          }
        } catch (locErr) {
          console.error("Location creation error:", locErr);
          // Continue with profile creation, but inform about location error
          toast({
            title: "Uwaga",
            description: "Wystąpił błąd podczas tworzenia lokalizacji",
            variant: "destructive",
          });
        }
      }

      // Try direct insert to profiles instead of using RPC
      try {
        console.log("Tworzenie profilu użytkownika bezpośrednim zapytaniem...");
        const { error: directProfileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name: name,
            role: role,
            email: email,
            location_id: locationId
          });

        if (directProfileError) {
          console.error("Error creating profile directly:", directProfileError);
          
          // As a fallback, try using the RPC method
          console.log("Próba utworzenia profilu przy użyciu RPC...");
          const { error: profileError } = await supabase.rpc('insert_profile_admin', { 
            user_id: data.user.id,
            user_name: name,
            user_role: role,
            user_email: email,
            location_id: locationId
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
        const success = await Promise.race([
          login(email, password),
          timeout(10000) // 10 second timeout
        ]);
        
        if (success) {
          toast({
            title: "Rejestracja udana",
            description: "Konto zostało utworzone. Jesteś teraz zalogowany.",
            duration: 5000,
          });
          navigate(from, { replace: true });
        } else {
          toast({
            title: "Rejestracja udana",
            description: "Konto zostało utworzone, ale nie udało się zalogować automatycznie. Możesz zalogować się ręcznie.",
            duration: 5000,
          });
          setIsSigningUp(false);
        }
      } catch (loginErr) {
        console.error("Error during auto-login:", loginErr);
        toast({
          title: "Rejestracja udana",
          description: "Konto zostało utworzone, ale nie udało się zalogować automatycznie. Możesz zalogować się ręcznie.",
          duration: 5000,
        });
        setIsSigningUp(false);
      }
      
      // Clear form
      setEmail('');
      setPassword('');
      setName('');
      setLocation('');
      setRole('ekonom');
      
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err?.message || "Wystąpił problem podczas rejestracji. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <div className="bg-white p-8 rounded-md shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-omi-500">OMI Finanse</h1>
          <p className="text-omi-gray-500 mt-1">
            {isSigningUp ? 'Utwórz nowe konto' : 'Zaloguj się do systemu'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={isSigningUp ? handleSignUp : handleSubmit} className="space-y-4">
          {isSigningUp && (
            <div>
              <Label htmlFor="name" className="omi-form-label">
                Imię i nazwisko
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="omi-form-input"
                required
                placeholder="Wprowadź imię i nazwisko"
              />
            </div>
          )}
          
          <div>
            <Label htmlFor="email" className="omi-form-label">
              Adres email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="omi-form-input"
              required
              placeholder="Wprowadź adres email"
            />
          </div>

          <div>
            <Label htmlFor="password" className="omi-form-label">
              Hasło
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="omi-form-input"
              required
              placeholder={isSigningUp ? "Min. 6 znaków" : "Wprowadź hasło"}
            />
          </div>

          {isSigningUp && (
            <>
              <div>
                <Label htmlFor="role" className="omi-form-label">
                  Rola
                </Label>
                <Select 
                  value={role} 
                  onValueChange={(value) => setRole(value as Role)}
                >
                  <SelectTrigger className="omi-form-input">
                    <SelectValue placeholder="Wybierz rolę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ekonom">Ekonom</SelectItem>
                    <SelectItem value="prowincjal">Prowincjał</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="location" className="omi-form-label">
                  Dom zakonny (opcjonalnie)
                </Label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="omi-form-input"
                  placeholder="Nazwa domu zakonnego"
                />
              </div>
            </>
          )}

          {!isSigningUp && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 border-omi-gray-300 rounded text-omi-500 focus:ring-omi-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-omi-gray-700">
                  Zapamiętaj mnie
                </label>
              </div>

              <div>
                <a href="#" className="text-sm text-omi-500 hover:text-omi-600">
                  Zapomniałeś hasła?
                </a>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="omi-btn omi-btn-primary w-full flex justify-center"
          >
            {isLoading ? <Spinner size="sm" /> : (isSigningUp ? 'Zarejestruj się' : 'Zaloguj się')}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setIsSigningUp(!isSigningUp)}
              className="text-sm text-omi-500 hover:text-omi-600"
            >
              {isSigningUp 
                ? 'Masz już konto? Zaloguj się' 
                : 'Nie masz konta? Zarejestruj się'}
            </button>
          </div>

          <div className="text-center mt-4 text-xs text-omi-gray-500">
            <p>Dane testowe:</p>
            <p>Email: <strong>admin@omi.pl</strong>, <strong>prowincjal@omi.pl</strong>, <strong>ekonom@omi.pl</strong></p>
            <p>Hasło: <strong>password123</strong></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
