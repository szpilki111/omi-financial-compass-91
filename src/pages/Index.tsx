import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BarChart3, Wallet, Building2 } from 'lucide-react';
import oblaciLogo from '@/assets/oblaci-logo.png';

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
      <div className="min-h-screen bg-gradient-to-br from-white via-amber-50/30 to-amber-100/50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: FileText,
      title: 'Dokumenty',
      description: 'Tworzenie i zarządzanie dokumentami finansowymi z wieloma transakcjami',
    },
    {
      icon: BarChart3,
      title: 'Raporty',
      description: 'Generowanie raportów finansowych i szczegółowych analiz',
    },
    {
      icon: Wallet,
      title: 'Zarządzanie finansami',
      description: 'Kompleksowe narzędzia do kontroli budżetu i przepływów',
    },
    {
      icon: Building2,
      title: 'Domy zakonne',
      description: 'Centralne zarządzanie finansami wszystkich placówek',
    },
  ];

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-amber-50/30 to-amber-100/50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 sm:py-20">
        <div className="text-center mb-16 animate-fade-in">
          <div className="mb-8 flex justify-center">
            <img 
              src={oblaciLogo} 
              alt="Misjonarze Oblaci Maryi Niepokalanej" 
              className="h-32 sm:h-40 md:h-48 w-auto object-contain drop-shadow-lg"
            />
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
            System Finansowy OMI
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-600 mb-3 font-light">
            Misjonarze Oblaci Maryi Niepokalanej
          </p>
          
          <p className="text-base sm:text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
            Profesjonalne zarządzanie finansami domów zakonnych
          </p>
          
          <Button 
            onClick={() => navigate('/login')}
            size="lg"
            className="px-10 py-6 text-lg bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Zaloguj się
          </Button>
        </div>

        {/* Features Section */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mt-16">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-amber-100 bg-white/80 backdrop-blur-sm animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-3 bg-amber-100 rounded-full w-fit group-hover:bg-amber-200 transition-colors duration-300">
                  <feature.icon className="h-8 w-8 text-amber-700" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <CardDescription className="text-gray-600 leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-amber-200/50 bg-white/50 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} System Finansowy OMI • 
            <a 
              href="https://marekglowacki.pl" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 text-amber-700 hover:text-amber-800 font-medium transition-colors"
            >
              marekglowacki.pl
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
