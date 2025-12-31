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
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white py-4 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-center gap-3 text-center">
          <div className="flex items-center gap-2 animate-pulse">
            <svg className="w-6 h-6 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="font-semibold text-lg">Testy zakończone pomyślnie!</span>
            <span className="mx-2 text-emerald-200">•</span>
            <span className="text-emerald-100">Witamy w pełnej wersji systemu gotowego do pracy</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 ml-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
              v1.0 Production
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-12 animate-fade-in">
          {/* Production Ready Badge */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-700">System w pełni operacyjny</span>
            </div>
          </div>

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
          
          <p className="text-base sm:text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            Profesjonalne zarządzanie finansami domów zakonnych
          </p>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Bezpieczny i przetestowany</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Gotowy do użytku</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Wsparcie techniczne</span>
            </div>
          </div>
          
          <Button 
            onClick={() => navigate('/login')}
            size="lg"
            className="px-10 py-6 text-lg bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Zaloguj się do systemu
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
              marekglowacki.pl • 
            </a>
            <a 
              href="https://glowaccy-solutions.pl" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 text-amber-700 hover:text-amber-800 font-medium transition-colors"
            >
              glowaccy-solutions.pl
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
