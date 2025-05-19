
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import StatCard from '@/components/dashboard/StatCard';
import NotificationCard from '@/components/dashboard/NotificationCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { FileText, BarChart3, Book, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  action_label?: string;
  action_link?: string;
  user_id: string;
  created_at: string;
}

interface Statistic {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const isLocalUser = user?.role === 'ekonom';
  const isAdmin = user?.role === 'prowincjal' || user?.role === 'admin';

  // Pobieranie powiadomień z bazy danych
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(5);
          
        if (error) {
          throw error;
        }
        
        // Konwertujemy dane z bazy do odpowiedniego formatu
        const typedNotifications = data?.map(notification => ({
          ...notification,
          priority: notification.priority as 'low' | 'medium' | 'high'
        })) || [];
        
        setNotifications(typedNotifications);
      } catch (error) {
        console.error('Błąd podczas pobierania powiadomień:', error);
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać powiadomień",
          variant: "destructive",
        });
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [user]);

  // Pobieranie statystyk (w rzeczywistej aplikacji byłyby to prawdziwe dane)
  useEffect(() => {
    // To jest symulacja pobierania statystyk
    // W rzeczywistej aplikacji dane byłyby pobierane z bazy
    setTimeout(() => {
      setStatistics([
        {
          title: 'Operacje w tym miesiącu',
          value: isLocalUser ? '24' : '152',
          icon: <CreditCard className="h-6 w-6 text-blue-500" />
        },
        {
          title: 'Złożone raporty',
          value: isLocalUser ? '1/1' : '32/40',
          icon: <FileText className="h-6 w-6 text-green-500" />
        },
        {
          title: 'Saldo',
          value: isLocalUser ? '12 450 PLN' : '862 730 PLN',
          change: 5.2,
          icon: <BarChart3 className="h-6 w-6 text-purple-500" />
        },
      ]);
      setIsLoadingStats(false);
    }, 1000);
  }, [isLocalUser]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
        
      if (error) {
        throw error;
      }
      
      // Aktualizacja stanu lokalnego
      setNotifications(prevNotifications =>
        prevNotifications.map(notification =>
          notification.id === id
            ? { ...notification, read: true }
            : notification
        )
      );
      
    } catch (error) {
      console.error('Błąd podczas oznaczania powiadomienia jako przeczytane:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować statusu powiadomienia",
        variant: "destructive",
      });
    }
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
    if (isLoadingStats) {
      return (
        <div className="text-center p-6 bg-white rounded-lg shadow-sm border border-omi-gray-200">
          <p className="text-omi-gray-500">Ładowanie statystyk...</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statistics.map((stat, index) => (
          <StatCard 
            key={index}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            icon={stat.icon}
          />
        ))}
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
              {isLoadingNotifications ? (
                <div className="bg-white rounded-lg shadow-sm border border-omi-gray-200 p-4">
                  <p className="text-omi-gray-500">Ładowanie powiadomień...</p>
                </div>
              ) : notifications.length > 0 ? (
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
