
import React from 'react';
import Header from './Header';
import { Toaster } from '@/components/ui/toaster';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { useAuth } from '@/context/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-omi-gray-100">
      <Header />
      <main className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <Toaster />
      {user && <ErrorReportButton />}
    </div>
  );
};

export default MainLayout;
