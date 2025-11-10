
import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import { Toaster } from '@/components/ui/toaster';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { useAuth } from '@/context/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

const MainLayout = ({ children, fullWidth = false }: MainLayoutProps) => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-omi-gray-100">
      <Header />
      <main className={fullWidth ? "py-6 px-4 sm:px-6 lg:px-8" : "mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8"}>
        {children}
      </main>
      <Toaster />
      {user && <ErrorReportButton />}
    </div>
  );
};

export default MainLayout;
