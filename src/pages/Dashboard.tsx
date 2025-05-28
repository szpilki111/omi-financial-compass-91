
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import FinancialCard from '@/components/dashboard/FinancialCard';
import QuickAccessCard from '@/components/dashboard/QuickAccessCard';
import NotificationCard from '@/components/dashboard/NotificationCard';
import { FileText, TrendingUp, TrendingDown, Plus, BarChart, Database, BookOpen } from 'lucide-react';

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
        .limit(3);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Pobieranie danych finansowych
  const { data: financialData, isLoading: loadingFinancial } = useQuery({
    queryKey: ['financial-data', user?.location],
    queryFn: async () => {
      if (!user?.location) return null;

      // Pobierz najnowszy zaakceptowany raport dla placówki
      const { data: latestReport, error: reportError } = await supabase
        .from('reports')
        .select(`
          *,
          report_details (
            income_total,
            expense_total,
            balance
          )
        `)
        .eq('location_id', user.location)
        .eq('status', 'approved')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reportError) throw reportError;

      // Pobierz poprzedni raport do porównania
      let previousReport = null;
      if (latestReport) {
        const { data: prevReport } = await supabase
          .from('reports')
          .select(`
            *,
            report_details (
              income_total,
              expense_total,
              balance
            )
          `)
          .eq('location_id', user.location)
          .eq('status', 'approved')
          .lt('year', latestReport.year)
          .or(`year.eq.${latestReport.year},month.lt.${latestReport.month}`)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle();

        previousReport = prevReport;
      }

      return {
        current: latestReport,
        previous: previousReport
      };
    },
    enabled: !!user?.location
  });

  // Pobieranie informacji o placówce
  const { data: locationInfo } = useQuery({
    queryKey: ['location-info', user?.location],
    queryFn: async () => {
      if (!user?.location) return null;
      
      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .eq('id', user.location)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.location
  });

  const calculatePercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const currentData = financialData?.current?.report_details;
  const previousData = financialData?.previous?.report_details;

  const incomeChange = currentData && previousData 
    ? calculatePercentageChange(Number(currentData.income_total), Number(previousData.income_total))
    : 0;

  const expenseChange = currentData && previousData
    ? calculatePercentageChange(Number(currentData.expense_total), Number(previousData.expense_total))
    : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Nagłówek z powitaniem */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Witaj, {user?.name || 'Użytkowniku'}
          </h1>
          <p className="text-gray-600">
            {locationInfo?.name} - Podsumowanie
          </p>
        </div>

        {/* Karty finansowe */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FinancialCard
            title="Bilans bieżący"
            amount={currentData ? Number(currentData.balance) : 0}
            subtitle={`Stan na dzień ${format(new Date(), 'dd.MM.yyyy', { locale: pl })}`}
            icon={<FileText className="h-6 w-6" />}
            loading={loadingFinancial}
          />

          <FinancialCard
            title="Przychody (kwiecień)"
            amount={currentData ? Number(currentData.income_total) : 0}
            subtitle={incomeChange !== 0 ? `${incomeChange > 0 ? '+' : ''}${incomeChange.toFixed(1)}% w/w` : ''}
            icon={<TrendingUp className="h-6 w-6" />}
            trend={incomeChange > 0 ? 'up' : incomeChange < 0 ? 'down' : 'neutral'}
            trendColor="green"
            loading={loadingFinancial}
          />

          <FinancialCard
            title="Rozchody (kwiecień)"
            amount={currentData ? Number(currentData.expense_total) : 0}
            subtitle={expenseChange !== 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange.toFixed(1)}% w/w` : ''}
            icon={<TrendingDown className="h-6 w-6" />}
            trend={expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'neutral'}
            trendColor="red"
            loading={loadingFinancial}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Szybki dostęp */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Szybki dostęp</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickAccessCard
                  title="Nowa operacja KPiR"
                  icon={<Plus className="h-6 w-6" />}
                  onClick={() => window.location.href = '/kpir'}
                />
                <QuickAccessCard
                  title="Nowy raport"
                  icon={<FileText className="h-6 w-6" />}
                  onClick={() => window.location.href = '/reports'}
                />
                <QuickAccessCard
                  title="Wizualizacja danych"
                  icon={<BarChart className="h-6 w-6" />}
                  onClick={() => window.location.href = '/wizualizacja'}
                />
                <QuickAccessCard
                  title="Baza wiedzy"
                  icon={<BookOpen className="h-6 w-6" />}
                  onClick={() => {/* Implement knowledge base navigation */}}
                />
              </div>
            </div>

            {/* Ostatnia aktywność */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Ostatnia aktywność</h2>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <p className="text-gray-500 italic">Brak ostatniej aktywności.</p>
              </div>
            </div>
          </div>

          {/* Powiadomienia */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Powiadomienia</h2>
            <div className="space-y-3">
              {loadingNotifications ? (
                <div className="text-center p-4 text-gray-500">Ładowanie powiadomień...</div>
              ) : notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={{
                      id: notification.id,
                      title: notification.title,
                      message: notification.message,
                      date: format(new Date(notification.date), 'PPP', { locale: pl }),
                      priority: notification.priority as 'low' | 'medium' | 'high',
                      read: notification.read,
                      action_label: notification.action_label,
                      action_link: notification.action_link
                    }}
                  />
                ))
              ) : (
                <div className="bg-white p-4 rounded-lg shadow-sm text-center text-gray-500">
                  Brak nowych powiadomień
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
