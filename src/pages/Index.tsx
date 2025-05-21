
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  useEffect(() => {
    console.log("Index page - isAuthenticated:", isAuthenticated, "isLoading:", isLoading, "user:", user);
    
    const redirectTimeout = setTimeout(() => {
      if (!isLoading) {
        if (isAuthenticated) {
          console.log("User is authenticated, redirecting to dashboard");
          navigate('/dashboard');
        } else {
          console.log("User is not authenticated, redirecting to login");
          navigate('/login');
        }
      }
    }, 100); // Dodajemy małe opóźnienie, aby dać czas na pełne załadowanie kontekstu auth
    
    return () => clearTimeout(redirectTimeout);
  }, [navigate, isAuthenticated, isLoading, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-omi-gray-600">Ładowanie aplikacji...</p>
      </div>
    </div>
  );
};

export default Index;
