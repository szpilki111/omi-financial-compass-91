
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import StatCard from '@/components/dashboard/StatCard';
import NotificationCard from '@/components/dashboard/NotificationCard';
import ReportStatusCard from '@/components/dashboard/ReportStatusCard';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const Dashboard = () => {
  const { user } = useAuth();

  // Pobieranie powiadomień
  const { data: notifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Statystyki dla ekonoma
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats', user?.location],
    queryFn: async () => {
      if (!user?.location) return null;

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Statystyki transakcji
      const { data: transactionStats, error: transactionError } = await supabase
        .from('transactions')
        .select('amount, settlement_type')
        .eq('location_id', user.location)
        .gte('date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

      if (transactionError) throw transactionError;

      // Statystyki raportów
      const { data: reportCount, error: reportError } = await supabase
        .from('reports')
        .select('status')
        .eq('location_id', user.location)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (reportError) throw reportError;

      const totalTransactions = transactionStats?.length || 0;
      const totalAmount = transactionStats?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const reportsThisMonth = reportCount?.length || 0;
      
      return {
        totalTransactions,
        totalAmount,
        reportsThisMonth,
        cashTransactions: transactionStats?.filter(t => t.settlement_type === 'Gotówka').length || 0
      };
    },
    enabled: !!user?.location && user?.role === 'ekonom'
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle title="Panel główny" />
        
        {/* Statystyki */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatusCard />
          
          {user?.role === 'ekonom' && stats && (
            <>
              <StatCard
                title="Transakcje w miesiącu"
                value={stats.totalTransactions.toString()}
                description="Łączna liczba operacji"
              />
              <StatCard
                title="Suma operacji"
                value={`${stats.totalAmount.toLocaleString('pl-PL')} PLN`}
                description="Wartość wszystkich operacji"
              />
              <StatCard
                title="Operacje gotówkowe"
                value={stats.cashTransactions.toString()}
                description="Liczba operacji gotówkowych"
              />
            </>
          )}
        </div>

        {/* Powiadomienia */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Powiadomienia</h2>
            <div className="space-y-3">
              {loadingNotifications ? (
                <div className="text-center p-4 text-gray-500">Ładowanie powiadomień...</div>
              ) : notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    title={notification.title}
                    message={notification.message}
                    date={format(new Date(notification.date), 'PPP', { locale: pl })}
                    priority={notification.priority as 'low' | 'medium' | 'high'}
                    actionLink={notification.action_link}
                    actionLabel={notification.action_label}
                  />
                ))
              ) : (
                <div className="text-center p-4 text-gray-500">Brak nowych powiadomień</div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Szybkie działania</h2>
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-medium mb-2">Książka przychodów i rozchodów</h3>
                <p className="text-sm text-gray-600 mb-3">Dodaj nową operację finansową</p>
                <button 
                  onClick={() => window.location.href = '/kpir'}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Przejdź do KPiR →
                </button>
              </div>
              
              {user?.role === 'ekonom' && (
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <h3 className="font-medium mb-2">Raporty</h3>
                  <p className="text-sm text-gray-600 mb-3">Zarządzaj raportami miesięcznymi</p>
                  <button 
                    onClick={() => window.location.href = '/reports'}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Przejdź do raportów →
                  </button>
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
