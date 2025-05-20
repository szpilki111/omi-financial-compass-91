
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    console.log("Index page - isAuthenticated:", isAuthenticated, "isLoading:", isLoading);
    
    if (!isLoading) {
      if (isAuthenticated) {
        console.log("User is authenticated, redirecting to dashboard");
        navigate('/dashboard');
      } else {
        console.log("User is not authenticated, redirecting to login");
        navigate('/login');
      }
    }
  }, [navigate, isAuthenticated, isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <Spinner size="lg" />
    </div>
  );
};

export default Index;
