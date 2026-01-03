import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session } from '@supabase/supabase-js';

type Role = 'ekonom' | 'prowincjal' | 'admin' | 'proboszcz' | 'asystent' | 'asystent_ekonoma_prowincjalnego' | 'ekonom_prowincjalny';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
  location: string;
  locations: string[];           // wszystkie przypisane lokalizacje (ID)
  locationIdentifiers: string[]; // identyfikatory lokalizacji (np. ["2-1", "2-3"])
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

  useEffect(() => {
    const fetchUserProfile = async (userId: string) => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`id, name, email, role, location_id`)
          .eq('id', userId)
          .maybeSingle();

        if (error || !profile) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Pobierz wszystkie lokalizacje użytkownika z user_locations
        const { data: userLocations } = await supabase
          .from('user_locations')
          .select('location_id')
          .eq('user_id', userId);

        const locationIds = userLocations?.map(ul => ul.location_id) || [];
        
        // Jeśli brak w user_locations, użyj location_id z profilu
        if (locationIds.length === 0 && profile.location_id) {
          locationIds.push(profile.location_id);
        }

        // Pobierz identyfikatory lokalizacji
        let locationIdentifiers: string[] = [];
        if (locationIds.length > 0) {
          const { data: locationsData } = await supabase
            .from('locations')
            .select('id, location_identifier')
            .in('id', locationIds);
          
          locationIdentifiers = locationsData
            ?.map(l => l.location_identifier)
            .filter((id): id is string => !!id) || [];
        }

        setUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as Role,
          location: profile.location_id || locationIds[0] || '',
          locations: locationIds,
          locationIdentifiers: locationIdentifiers,
        });
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          setTimeout(() => {
            fetchUserProfile(currentSession.user.id);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        
        if (currentSession?.user) {
          fetchUserProfile(currentSession.user.id);
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const normalizedEmail = email.trim().toLowerCase();

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, blocked')
        .eq('email', normalizedEmail)
        .maybeSingle();

      const userId = profileData?.id || null;

      if (profileData?.blocked) {
        toast({
          title: "Konto zablokowane",
          description: "Twoje konto zostało zablokowane. Skontaktuj się z administratorem.",
          variant: "destructive",
        });
        setIsLoading(false);
        return false;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        // Log failed login attempt
        try {
          await supabase.functions.invoke('log-login-event', {
            body: {
              user_id: userId,
              email: normalizedEmail,
              success: false,
              error_message: error.message,
            },
          });
        } catch {
          // Ignore logging errors
        }

        // Update failed_logins counter
        const { data: failedLogin } = await supabase
          .from('failed_logins')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (failedLogin) {
          const newCount = failedLogin.attempt_count + 1;

          await supabase
            .from('failed_logins')
            .update({
              attempt_count: newCount,
              last_attempt: new Date().toISOString(),
            })
            .eq('email', normalizedEmail);

          if (newCount >= 5) {
            await supabase
              .from('profiles')
              .update({ blocked: true })
              .eq('email', normalizedEmail);

            toast({
              title: "Konto zablokowane",
              description: "Zbyt wiele nieudanych prób logowania. Konto zostało zablokowane. Skontaktuj się z prowincjałem.",
              variant: "destructive",
            });
          }
        } else {
          await supabase
            .from('failed_logins')
            .insert({
              email: normalizedEmail,
              attempt_count: 1,
              last_attempt: new Date().toISOString(),
            });
        }

        // Check recent failures
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: recentFailures } = await supabase
          .from('failed_logins')
          .select('attempt_count')
          .eq('email', normalizedEmail)
          .gte('last_attempt', fifteenMinutesAgo)
          .maybeSingle();

        const failureCount = recentFailures?.attempt_count || 0;

        if (failureCount >= 5 && userId) {
          await supabase
            .from('profiles')
            .update({ blocked: true })
            .eq('email', normalizedEmail);

          toast({
            title: "Konto zablokowane",
            description: "Zbyt wiele nieudanych prób logowania. Konto zostało zablokowane. Skontaktuj się z prowincjałem.",
            variant: "destructive",
          });
        }

        const errorMessage = error.message === "Invalid login credentials" 
          ? "Nieprawidłowy email lub hasło" 
          : error.message;

        toast({
          title: "Błąd logowania",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return false;
      }

      if (data?.user) {
        // Log successful login
        try {
          await supabase.functions.invoke('log-login-event', {
            body: {
              user_id: data.user.id,
              email: normalizedEmail,
              success: true,
              error_message: null,
            },
          });
        } catch {
          // Ignore logging errors
        }

        // Check if blocked
        const { data: finalCheck } = await supabase
          .from('profiles')
          .select('blocked')
          .eq('id', data.user.id)
          .maybeSingle();

        if (finalCheck?.blocked) {
          await supabase.auth.signOut();
          toast({
            title: "Konto zablokowane",
            description: "Twoje konto zostało zablokowane po zbyt wielu nieudanych próbach logowania. Skontaktuj się z prowincjałem.",
            variant: "destructive",
          });
          setIsLoading(false);
          return false;
        }

        // Clear failed_logins on successful login
        const { data: failedLogin } = await supabase
          .from('failed_logins')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (failedLogin) {
          if (failedLogin.attempt_count >= 5) {
            await supabase
              .from('profiles')
              .update({ blocked: true })
              .eq('email', normalizedEmail);

            await supabase.auth.signOut();

            toast({
              title: "Zbyt wiele błędnych logowań",
              description: "Twoje konto zostało tymczasowo zablokowane z powodu zbyt wielu nieudanych prób logowania. Skontaktuj się z administratorem.",
              variant: "destructive",
            });
            setIsLoading(false);
            return false;
          } else {
            await supabase
              .from('failed_logins')
              .delete()
              .eq('email', normalizedEmail);
          }
        }

        setIsLoading(false);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch {
      toast({
        title: "Błąd logowania",
        description: "Wystąpił nieoczekiwany problem podczas logowania",
        variant: "destructive",
      });
      setIsLoading(false);
      return false;
    }
  };
  
  const logout = async () => {
    try {
      setIsLoading(true);
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      const isSessionNotFoundError = error && (
        error.message?.includes('Session not found') ||
        error.message?.includes("doesn't exist")
      );
      
      if (error && !isSessionNotFoundError) {
        toast({
          title: "Błąd wylogowania",
          description: "Wystąpił problem podczas wylogowania",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Wylogowano",
          description: "Zostałeś pomyślnie wylogowany",
        });
      }
      
      navigate('/', { replace: true });
    } catch {
      toast({
        title: "Błąd wylogowania",
        description: "Wystąpił nieoczekiwany problem podczas wylogowania",
        variant: "destructive",
      });
      navigate('/', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermission = (requiredRole: Role | Role[]) => {
    if (!user) return false;

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
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

export const useAuth = () => useContext(AuthContext);
