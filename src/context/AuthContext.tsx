
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';

type Role = 'ekonom' | 'prowincjal' | 'admin' | 'proboszcz' | 'asystent' | 'asystent_ekonoma_prowincjalnego' | 'ekonom_prowincjalny';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
  location: string; // Id domu zakonnego
}

interface AuthContextType {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkPermission: (requiredRole: Role | Role[]) => boolean;
  canApproveReports: boolean;
  canCreateReports: boolean;
}

// Create a context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
  checkPermission: () => false,
  canApproveReports: false,
  canCreateReports: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize auth state from Supabase on app load
  useEffect(() => {
    console.log('AuthProvider mounted');
    
    // Funkcja do pobierania profilu użytkownika z określonym timeoutem
    const fetchUserProfile = async (userId: string) => {
      try {
        console.log('Fetching profile for user ID:', userId);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            id,
            name,
            email,
            role,
            location_id
          `)
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          setUser(null);
          setIsLoading(false);
          return;
        }

        console.log('Profile fetched:', profile);

        if (profile) {
          setUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role as Role,
            location: profile.location_id || '',
          });
          console.log('User state updated with profile data');
        } else {
          console.warn('No profile found for user:', userId);
          setUser(null);
        }
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Ustaw nasłuchiwanie zmiany stanu uwierzytelniania
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth state change event:', event);
        console.log('Session from event:', currentSession);
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Używamy setTimeout aby uniknąć rekurencyjnych wywołań Supabase
          setTimeout(() => {
            fetchUserProfile(currentSession.user.id);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // Sprawdź istniejącą sesję
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('Get session result:', currentSession);
        setSession(currentSession);
        
        if (currentSession?.user) {
          console.log('User found in session:', currentSession.user.id);
          fetchUserProfile(currentSession.user.id);
        } else {
          console.log('No user in session');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      console.log('AuthProvider unmounted');
      subscription.unsubscribe();
    };
  }, []);

  // Login function using Supabase auth
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('Attempting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('Login response:', { data, error });

      if (error) {
        console.error('Login error from Supabase:', error);
        
        // Mapowanie błędów Supabase na bardziej przyjazne komunikaty
        let errorMessage = error.message;
        if (error.message === "Invalid login credentials") {
          errorMessage = "Nieprawidłowy email lub hasło";
        }
        
        toast({
          title: "Błąd logowania",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return false;
      }

      if (data?.user) {
        // Profil zostanie załadowany przez onAuthStateChange
        console.log("Zalogowano pomyślnie, użytkownik:", data.user.id);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (error: any) {
      console.error('Unexpected login error:', error);
      toast({
        title: "Błąd logowania",
        description: "Wystąpił nieoczekiwany problem podczas logowania",
        variant: "destructive",
      });
      setIsLoading(false);
      return false;
    } finally {
      window.location.reload();
    }
  };

const logout = async () => {
    try {
      console.log('Starting logout process');
      setIsLoading(true);
      
      // Wyczyść stan lokalnie przed wywołaniem Supabase
      setUser(null);
      setSession(null);
      
      // Wyloguj z Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        toast({
          title: "Błąd wylogowania",
          description: "Wystąpił problem podczas wylogowania",
          variant: "destructive",
        });
      } else {
        console.log('Successfully logged out');
        toast({
          title: "Wylogowano",
          description: "Zostałeś pomyślnie wylogowany",
        });
      }
      
      // Przekieruj do strony logowania
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Unexpected logout error:', error);
      toast({
        title: "Błąd wylogowania",
        description: "Wystąpił nieoczekiwany problem podczas wylogowania",
        variant: "destructive",
      });
      
      // Mimo błędu, spróbuj przekierować do strony logowania
      navigate('/', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to check if user has required role(s)
  const checkPermission = (requiredRole: Role | Role[]) => {
    if (!user) return false;

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    // Uproszczona logika uprawnień:
    // - admin ma wszystkie uprawnienia
    // - prowincjal ma identyczne uprawnienia co admin 
    // - ekonom ma tylko swoje uprawnienia
    switch (requiredRole) {
      case 'admin':
        return user.role === 'admin' || user.role === 'prowincjal';
      case 'prowincjal':
        return user.role === 'admin' || user.role === 'prowincjal';
      case 'ekonom':
        return user.role === 'ekonom' || user.role === 'prowincjal' || user.role === 'admin';
      default:
        return false;
    }
  };

  // Definicje uprawnień jako computed values
  const canApproveReports = user?.role === 'admin' || user?.role === 'prowincjal';
  const canCreateReports = user?.role === 'ekonom';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkPermission,
        canApproveReports,
        canCreateReports,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
