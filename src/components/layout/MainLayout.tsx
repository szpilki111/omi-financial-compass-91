
import React from 'react';
import Header from './Header';
import { Toaster } from '@/components/ui/toaster';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen symfonia-container">
      <Header />
      <main className="mx-auto max-w-7xl py-2 px-2">
        <div className="symfonia-window min-h-[calc(100vh-80px)]">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
};

export default MainLayout;
