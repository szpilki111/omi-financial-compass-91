
import React, { useEffect } from 'react';
import Header from './Header';
import { Toaster } from '@/components/ui/toaster';
import { ErrorReportButton } from '@/components/ErrorReportButton';
import { useAuth } from '@/context/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { user } = useAuth();

  // Add warning before closing browser/tab for logged in users
  useEffect(() => {
    if (!user) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

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
