
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Redirect authenticated users to documents page instead of dashboard
      navigate('/dokumenty', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            System Finansowy OMI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Zarządzanie finansami domów zakonnych
          </p>
          <Button 
            onClick={() => navigate('/login')}
            size="lg"
            className="px-8 py-3 text-lg"
          >
            Zaloguj się
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Dokumenty</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Tworzenie i zarządzanie dokumentami finansowymi z wieloma transakcjami
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Raporty</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Generowanie raportów finansowych i analiz
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
