
import React from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import StatCard from '@/components/dashboard/StatCard';
import NotificationCard from '@/components/dashboard/NotificationCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { FileText, BarChart3, Book, CreditCard } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLocalUser = user?.role === 'ekonom';
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // Mock data for dashboard
  const mockNotifications = [
    {
      id: '1',
      title: 'Raport za kwiecień 2025',
      message: 'Raport za kwiecień 2025 czeka na złożenie. Termin: 10 maja 2025.',
      date: '2 maja 2025',
      priority: 'high' as const,
      read: false,
      action: {
        label: 'Złóż raport',
        link: '/raporty/nowy',
      },
    },
    {
      id: '2',
      title: 'Nowe dokumenty w bazie wiedzy',
      message: 'Dodano nowe dokumenty dotyczące rozliczania podróży służbowych.',
      date: '28 kwietnia 2025',
      priority: 'medium' as const,
      read: false,
      action: {
        label: 'Zobacz dokumenty',
        link: '/baza-wiedzy/dokumenty',
      },
    },
    {
      id: '3',
      title: 'Przypomnienie o szkoleniu',
      message: 'Szkolenie z nowych funkcji systemu odbędzie się 15 maja o godz. 10:00.',
      date: '27 kwietnia 2025',
      priority: 'low' as const,
      read: true,
    },
  ];

  const handleMarkAsRead = (id: string) => {
    // In a real app, this would call an API to mark notification as read
    console.log('Marking notification as read:', id);
  };

  const QuickAccessSection = () => (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-omi-gray-800 mb-4">Szybki dostęp</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          onClick={() => navigate('/kpir/nowy')}
          variant="outline"
          className="h-24 flex flex-col items-center justify-center border-omi-gray-300 hover:bg-omi-100"
        >
          <CreditCard className="w-6 h-6 mb-2 text-omi-500" />
          <span>Nowa operacja KPiR</span>
        </Button>
        <Button
          onClick={() => navigate('/raporty/nowy')}
          variant="outline"
          className="h-24 flex flex-col items-center justify-center border-omi-gray-300 hover:bg-omi-100"
        >
          <FileText className="w-6 h-6 mb-2 text-omi-500" />
          <span>Nowy raport</span>
        </Button>
        <Button
          onClick={() => navigate('/wizualizacja')}
          variant="outline"
          className="h-24 flex flex-col items-center justify-center border-omi-gray-300 hover:bg-omi-100"
        >
          <BarChart3 className="w-6 h-6 mb-2 text-omi-500" />
          <span>Wizualizacja danych</span>
        </Button>
        <Button
          onClick={() => navigate('/baza-wiedzy')}
          variant="outline"
          className="h-24 flex flex-col items-center justify-center border-omi-gray-300 hover:bg-omi-100"
        >
          <Book className="w-6 h-6 mb-2 text-omi-500" />
          <span>Baza wiedzy</span>
        </Button>
      </div>
    </div>
  );

  const StatisticsSection = () => {
    // Different stats based on user role
    if (isLocalUser) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Bilans bieżący"
            value="45 230,50 zł"
            description="Stan na dzień 01.05.2025"
            icon={<CreditCard className="w-6 h-6" />}
          />
          <StatCard
            title="Przychody (kwiecień)"
            value="22 450,00 zł"
            trend="up"
            trendValue="8,5% w/w"
            icon={<BarChart3 className="w-6 h-6" />}
          />
          <StatCard
            title="Rozchody (kwiecień)"
            value="18 720,30 zł"
            trend="down"
            trendValue="3,2% w/w"
            icon={<FileText className="w-6 h-6" />}
          />
        </div>
      );
    } else {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Domy złożyły raport"
            value="28/40"
            description="Raport za kwiecień 2025"
            icon={<FileText className="w-6 h-6" />}
          />
          <StatCard
            title="Suma przychodów"
            value="875 450,00 zł"
            description="Kwiecień 2025 (wszystkie placówki)"
            trend="up"
            trendValue="5,2% w/w"
            icon={<BarChart3 className="w-6 h-6" />}
          />
          <StatCard
            title="Suma rozchodów"
            value="754 230,30 zł"
            description="Kwiecień 2025 (wszystkie placówki)"
            trend="neutral"
            trendValue="0,8% w/w"
            icon={<BarChart3 className="w-6 h-6" />}
          />
          <StatCard
            title="Bilans prowincji"
            value="3 245 678,90 zł"
            description="Stan na dzień 01.05.2025"
            icon={<CreditCard className="w-6 h-6" />}
          />
        </div>
      );
    }
  };

  return (
    <MainLayout>
      <div>
        <PageTitle 
          title={`Witaj, ${user?.name || 'Użytkowniku'}`}
          subtitle={`${user?.location || 'OMI Finanse'} - Podsumowanie`}
        />

        <StatisticsSection />
        
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Quick access */}
          <div className="lg:col-span-2">
            <QuickAccessSection />
            
            {/* Recent activity would go here in a real app */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-omi-gray-800 mb-4">Ostatnia aktywność</h2>
              <div className="bg-white rounded-lg shadow-sm border border-omi-gray-200 p-4">
                <p className="text-omi-gray-500 italic">Brak ostatniej aktywności.</p>
              </div>
            </div>
          </div>
          
          {/* Right column - Notifications */}
          <div>
            <h2 className="text-lg font-medium text-omi-gray-800 mb-4">Powiadomienia</h2>
            <div>
              {mockNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
