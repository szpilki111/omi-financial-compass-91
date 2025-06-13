import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import FinancialCard from '@/components/dashboard/FinancialCard';
import QuickAccessCard from '@/components/dashboard/QuickAccessCard';
import NotificationCard from '@/components/dashboard/NotificationCard';
import ReportStatusCard from '@/components/dashboard/ReportStatusCard';
import { calculateFinancialSummary } from '@/utils/financeUtils';
import { FileText, TrendingUp, TrendingDown, Plus, BarChart, Database, BookOpen, Activity, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  const { user } = useAuth();

  // Pobieranie powiadomień o zmianach statusów raportów
  const { data: notifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Dla adminów i prowincjałów - powiadomienia o zmianach statusów raportów
      if (user.role === 'admin' || user.role === 'prowincjal') {
        const { data: recentReports, error } = await supabase
          .from('reports')
          .select(`
            id,
            title,
            status,
            submitted_at,
            reviewed_at,
            location_id,
            locations!inner(name)
          `)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        return recentReports?.map(report => ({
          id: report.id,
          title: `Raport: ${report.title}`,
          message: `${report.locations.name} - Status: ${getStatusText(report.status)}`,
          date: format(new Date(report.reviewed_at || report.submitted_at || new Date()), 'PPP', { locale: pl }),
          priority: report.status === 'submitted' ? 'medium' : 'low',
          read: false,
          action_label: 'Zobacz raport',
          action_link: `/reports/${report.id}`
        })) || [];
      } else {
        // Dla lokalnych ekonomów - standardowe powiadomienia
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!user?.id
  });

  // Pobieranie danych finansowych z bieżącego miesiąca
  const { data: currentMonthData, isLoading: loadingCurrentMonth } = useQuery({
    queryKey: ['current-month-financial-data', user?.location, user?.role],
    queryFn: async () => {
      if (!user) return { income: 0, expense: 0, balance: 0 };

      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfMonth.toISOString().split('T')[0];

      // Dla lokalnych ekonomów - tylko ich lokalizacja
      const locationId = user.role === 'ekonom' ? user.location : null;

      const summary = await calculateFinancialSummary(locationId, dateFrom, dateTo);
      return summary;
    },
    enabled: !!user
  });

  // Pobieranie danych z poprzedniego miesiąca do porównania
  const { data: previousMonthData } = useQuery({
    queryKey: ['previous-month-financial-data', user?.location, user?.role],
    queryFn: async () => {
      if (!user) return { income: 0, expense: 0, balance: 0 };

      const currentDate = new Date();
      const previousMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
      const previousYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

      const firstDayOfPrevMonth = new Date(previousYear, previousMonth, 1);
      const lastDayOfPrevMonth = new Date(previousYear, previousMonth + 1, 0);
      
      const dateFrom = firstDayOfPrevMonth.toISOString().split('T')[0];
      const dateTo = lastDayOfPrevMonth.toISOString().split('T')[0];

      // Dla lokalnych ekonomów - tylko ich lokalizacja
      const locationId = user.role === 'ekonom' ? user.location : null;

      const summary = await calculateFinancialSummary(locationId, dateFrom, dateTo);
      return summary;
    },
    enabled: !!user
  });

  // Pobieranie ostatniej aktywności użytkownika
  const { data: recentActivity, isLoading: loadingActivity } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      if (user.role === 'admin' || user.role === 'prowincjal') {
        // Dla adminów i prowincjałów - ostatnio zrecenzowane raporty
        const { data, error } = await supabase
          .from('reports')
          .select(`
            id,
            title,
            status,
            reviewed_at,
            location_id,
            locations!inner(name)
          `)
          .eq('reviewed_by', user.id)
          .not('reviewed_at', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        return data || [];
      } else {
        // Dla lokalnych ekonomów - ostatnie transakcje
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            debit_account:accounts!debit_account_id(number, name),
            credit_account:accounts!credit_account_id(number, name)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!user?.id
  });

  // Pobieranie informacji o placówce (tylko dla lokalnych ekonomów)
  const { data: locationInfo } = useQuery({
    queryKey: ['location-info', user?.location],
    queryFn: async () => {
      if (!user?.location || user.role !== 'ekonom') return null;
      
      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .eq('id', user.location)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.location && user?.role === 'ekonom'
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Wersja robocza';
      case 'submitted': return 'Złożony';
      case 'approved': return 'Zaakceptowany';
      case 'to_be_corrected': return 'Do poprawy';
      default: return status;
    }
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const formatChangeText = (change: number, type: 'income' | 'expense') => {
    if (change === 0) return 'Brak danych porównawczych';
    
    const direction = change > 0 ? '+' : '';
    const changeText = `${direction}${change.toFixed(1)}% w/w poprz. miesiąc`;
    
    return changeText;
  };

  const currentIncome = currentMonthData?.income || 0;
  const currentExpense = currentMonthData?.expense || 0;
  const currentBalance = currentMonthData?.balance || 0;

  const previousIncome = previousMonthData?.income || 0;
  const previousExpense = previousMonthData?.expense || 0;

  const incomeChange = calculatePercentageChange(currentIncome, previousIncome);
  const expenseChange = calculatePercentageChange(currentExpense, previousExpense);

  const currentMonth = format(new Date(), 'LLLL', { locale: pl });

  const getWelcomeMessage = () => {
    if (user?.role === 'admin') {
      return 'Panel administracyjny - Przegląd wszystkich placówek';
    } else if (user?.role === 'prowincjal') {
      return 'Panel prowincjała - Nadzór nad raportami';
    } else {
      return locationInfo?.name ? `Dom ${locationInfo.name}` : '';
    }
  };

  return (
   <MainLayout>
    <div className="space-y-6">
        {/* Nagłówek tytułowy */}
        <h1 className="text-2xl font-bold text-center">Witaj, {user?.name || 'Użytkowniku'}</h1>

        {/* Cards section */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
            <Link to="/dokumenty">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-center">Dokumenty</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription className="text-center">
                            Tworzenie i przeglądanie dokumentów
                        </CardDescription>
                    </CardContent>
                </Card>
            </Link>

            <Link to="/raporty">
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
            </Link>
        </div>
    </div>
</MainLayout>

  );
};

export default Dashboard;
