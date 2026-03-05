import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '../ui/Spinner';

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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    // Pass reason in state so Login page can show toast only when appropriate
    return <Navigate to="/login" state={{ from: location, sessionExpired: true }} replace />;
  }

  if (requiredRole && !checkPermission(requiredRole)) {
    return <Navigate to="/dostep-zabroniony" />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
