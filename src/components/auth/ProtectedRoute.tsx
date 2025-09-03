
import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '../ui/Spinner';
import { useToast } from '@/hooks/use-toast';

type Role = 'ekonom' | 'prowincjal' | 'admin' | 'proboszcz' | 'asystent' | 'asystent_ekonoma_prowincjalnego' | 'ekonom_prowincjalny';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role | Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isLoading, checkPermission } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Debug - sprawdzamy, czy komponent się renderuje i co zawiera
    console.log('ProtectedRoute render, user:', user);
    console.log('isLoading:', isLoading);
    console.log('Current location:', location.pathname);
    
    if (!isLoading && !user) {
      console.error('Brak zalogowanego użytkownika, przekierowanie do /login');
      toast({
        title: "Dostęp zabroniony",
        description: "Musisz być zalogowany, aby zobaczyć tę stronę",
        variant: "destructive",
      });
    }
  }, [isLoading, user, location.pathname, toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    console.log('Brak użytkownika, przekierowanie do logowania');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role permissions if specified
  if (requiredRole && !checkPermission(requiredRole)) {
    console.log(`Brak wymaganych uprawnień: ${requiredRole}, role użytkownika: ${user.role}`);
    return <Navigate to="/dostep-zabroniony" />;
  }

  // User is authenticated and has required role
  console.log('Użytkownik zautoryzowany, wyświetlam zawartość');
  return <>{children}</>;
};

export default ProtectedRoute;
