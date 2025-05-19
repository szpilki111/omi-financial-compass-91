
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Role = 'ekonom' | 'prowincjal' | 'admin';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
  location: string; // Dom zakonny
}

interface AuthContextType {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkPermission: (requiredRole: Role | Role[]) => boolean;
}

// Create a context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
  checkPermission: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize auth state from localStorage on app load
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Login function - to be replaced with Supabase auth
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Placeholder for future Supabase authentication
      // W przyszłości zostanie zastąpione autentykacją Supabase
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Tymczasowo zwracamy błąd logowania
      toast({
        title: "Błąd logowania",
        description: "Funkcjonalność logowania jest w trakcie implementacji",
        variant: "destructive",
      });
      return false;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Błąd logowania",
        description: "Wystąpił problem podczas logowania",
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    navigate('/login');
    toast({
      title: "Wylogowano",
      description: "Zostałeś pomyślnie wylogowany",
    });
  };

  // Helper to check if user has required role(s)
  const checkPermission = (requiredRole: Role | Role[]) => {
    if (!user) return false;

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole || 
           (requiredRole === 'ekonom' && (user.role === 'prowincjal' || user.role === 'admin')) || 
           (requiredRole === 'prowincjal' && user.role === 'admin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
