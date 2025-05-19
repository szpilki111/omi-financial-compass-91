
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

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

// Mock user data for development
const MOCK_USERS = [
  {
    id: '1',
    name: 'Jan Kowalski',
    email: 'ekonom@omi.pl',
    password: 'haslo123',
    role: 'ekonom' as Role,
    location: 'Dom Zakonny Poznań'
  },
  {
    id: '2',
    name: 'Piotr Nowak',
    email: 'prowincjal@omi.pl',
    password: 'haslo123',
    role: 'prowincjal' as Role,
    location: 'Prowincjalat OMI'
  },
  {
    id: '3',
    name: 'Admin Systemowy',
    email: 'admin@omi.pl',
    password: 'haslo123',
    role: 'admin' as Role,
    location: 'Prowincjalat OMI'
  }
];

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

  // Mock login function - in a real app, this would call an API
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const foundUser = MOCK_USERS.find(
        u => u.email === email && u.password === password
      );

      if (!foundUser) {
        toast({
          title: "Błąd logowania",
          description: "Błędny email lub hasło",
          variant: "destructive",
        });
        return false;
      }

      // Create a user object without the password
      const { password: _, ...userData } = foundUser;
      
      // Store user in state and localStorage
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      toast({
        title: "Zalogowano pomyślnie",
        description: `Witaj, ${userData.name}!`,
      });
      
      return true;
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
