
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

  // Tymczasowe puste dane
  const notifications: any[] = [];

  const handleMarkAsRead = (id: string) => {
    console.log('Marking notification as read:', id);
    // Ta funkcja zostanie zaimplementowana, gdy powiadomienia będą pobierane z bazy danych
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
    // Tymczasowe puste statystyki
    return (
      <div className="text-center p-6 bg-white rounded-lg shadow-sm border border-omi-gray-200">
        <p className="text-omi-gray-500">Dane statystyczne będą dostępne po implementacji bazy danych.</p>
      </div>
    );
  };

  return (
    <MainLayout>
      <div>
        <PageTitle 
          title={`Witaj${user ? `, ${user.name}` : ''}`}
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
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-omi-gray-200 p-4">
                  <p className="text-omi-gray-500 italic">Brak powiadomień.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
